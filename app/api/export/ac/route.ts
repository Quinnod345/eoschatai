import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getAccessContext, incrementUsageCounter } from '@/lib/entitlements';
import { trackBlockedAction } from '@/lib/analytics';
import { db } from '@/lib/db';
import { document } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  createPDF,
  addHeader,
  addSectionHeading,
  addBodyText,
  addBulletList,
  addBox,
  addFooter,
  pdfToBuffer,
} from '@/lib/export/pdf-generator';
import {
  createTitle,
  createHeading,
  createBodyText,
  createBulletList,
  createHierarchyItem,
  generateDocx,
} from '@/lib/export/docx-generator';
import type { Paragraph, Table } from 'docx';

// Accountability Chart node structure
interface ACNode {
  id: string;
  name: string;
  role: string;
  responsibilities?: string[];
  children?: ACNode[];
}

interface ACData {
  nodes?: ACNode[];
  root?: ACNode;
  companyName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check entitlements
    const accessContext = await getAccessContext(session.user.id);

    if (!accessContext.entitlements.features.export) {
      await trackBlockedAction({
        feature: 'export',
        reason: 'not_enabled',
        user_id: session.user.id,
        org_id: accessContext.user.orgId,
        status: 403,
      });

      return NextResponse.json(
        {
          code: 'ENTITLEMENT_BLOCK',
          feature: 'export',
          reason: 'not_enabled',
        },
        { status: 403 },
      );
    }

    // Check monthly export limit
    const monthlyLimit = 10; // Configurable limit
    if (accessContext.user.usageCounters.exports_month >= monthlyLimit) {
      await trackBlockedAction({
        feature: 'export',
        reason: 'limit_exceeded',
        user_id: session.user.id,
        org_id: accessContext.user.orgId,
        status: 403,
      });

      return NextResponse.json(
        {
          code: 'ENTITLEMENT_BLOCK',
          feature: 'export',
          reason: 'limit_exceeded',
        },
        { status: 403 },
      );
    }

    const { documentId, format = 'pdf' } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 },
      );
    }

    // Fetch the accountability chart document
    const [acDoc] = await db
      .select()
      .from(document)
      .where(
        and(
          eq(document.id, documentId),
          eq(document.userId, session.user.id),
          eq(document.kind, 'accountability'),
        ),
      )
      .limit(1);

    if (!acDoc) {
      return NextResponse.json(
        { error: 'Accountability chart document not found' },
        { status: 404 },
      );
    }

    // Parse accountability chart data
    const content = acDoc.content || '';
    let acData;

    try {
      // Try to parse as JSON first (new format)
      acData = JSON.parse(content);
    } catch {
      // Fall back to extracting from wrapped format
      const acMatch = content.match(/AC_DATA_BEGIN\n([\s\S]*?)\nAC_DATA_END/);
      if (acMatch) {
        acData = JSON.parse(acMatch[1]);
      } else {
        return NextResponse.json(
          { error: 'Invalid accountability chart format' },
          { status: 400 },
        );
      }
    }

    // Increment usage counter
    await incrementUsageCounter(session.user.id, 'exports_month', 1);

    if (format === 'json') {
      // Return raw AC data as JSON
      return NextResponse.json({
        title: acDoc.title,
        createdAt: acDoc.createdAt,
        data: acData,
      });
    }

    // Generate PDF export
    if (format === 'pdf') {
      const pdfBuffer = generateACPdf(
        acData,
        acDoc.title || 'Accountability Chart',
      );
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${acDoc.title || 'Accountability-Chart'}.pdf"`,
        },
      });
    }

    // Generate DOCX export
    if (format === 'docx') {
      const docxBuffer = await generateACDocx(
        acData,
        acDoc.title || 'Accountability Chart',
      );
      return new NextResponse(new Uint8Array(docxBuffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${acDoc.title || 'Accountability-Chart'}.docx"`,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid export format' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[export.ac] Export failed', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

/**
 * Recursively render org chart nodes as boxes in PDF
 */
function renderACNodesPdf(
  doc: ReturnType<typeof createPDF>,
  nodes: ACNode[],
  startX: number,
  startY: number,
  level: number = 0,
): number {
  const boxWidth = 50;
  const boxHeight = 15;
  const horizontalGap = 10;
  const verticalGap = 20;

  let currentY = startY;
  const indent = level * 60;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const x = startX + indent;

    // Check for page break
    if (currentY > 250) {
      doc.addPage();
      currentY = 30;
    }

    // Draw the box
    addBox(doc, x, currentY, boxWidth, boxHeight, node.name, node.role);
    currentY += boxHeight + 5;

    // Render responsibilities if present
    if (node.responsibilities?.length) {
      doc.setFontSize(8);
      doc.setTextColor('#666666');
      for (const resp of node.responsibilities.slice(0, 3)) {
        if (currentY > 270) {
          doc.addPage();
          currentY = 30;
        }
        doc.text(`• ${resp}`, x + 5, currentY);
        currentY += 4;
      }
      currentY += 3;
    }

    // Recursively render children
    if (node.children?.length) {
      currentY = renderACNodesPdf(
        doc,
        node.children,
        startX,
        currentY + 5,
        level + 1,
      );
    }

    currentY += verticalGap;
  }

  return currentY;
}

/**
 * Generate PDF for Accountability Chart
 */
function generateACPdf(acData: ACData, title: string): Buffer {
  const doc = createPDF(title);
  let y = addHeader(doc, 'Accountability Chart™', acData.companyName || title);

  // Get root node or nodes array
  const nodes = acData.root ? [acData.root] : acData.nodes || [];

  if (nodes.length === 0) {
    y = addBodyText(doc, 'No organizational structure defined.', y);
  } else {
    y = addSectionHeading(doc, 'Organizational Structure', y);
    y = renderACNodesPdf(doc, nodes, 20, y, 0);
  }

  addFooter(doc, 'EOS AI - Accountability Chart');
  return pdfToBuffer(doc);
}

/**
 * Recursively render org chart nodes as hierarchy items in DOCX
 */
function renderACNodesDocx(nodes: ACNode[], level: number = 0): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const node of nodes) {
    // Add the person/role
    paragraphs.push(createHierarchyItem(node.name, node.role, level));

    // Add responsibilities as bullet points
    if (node.responsibilities?.length) {
      const respParagraphs = createBulletList(
        node.responsibilities.map((r) => `[${node.role}] ${r}`),
      );
      paragraphs.push(...respParagraphs);
    }

    // Recursively add children
    if (node.children?.length) {
      paragraphs.push(...renderACNodesDocx(node.children, level + 1));
    }
  }

  return paragraphs;
}

/**
 * Generate DOCX for Accountability Chart
 */
async function generateACDocx(acData: ACData, title: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  if (acData.companyName) {
    children.push(createBodyText(`Company: ${acData.companyName}`));
  }

  children.push(createHeading('Organizational Structure'));

  // Get root node or nodes array
  const nodes = acData.root ? [acData.root] : acData.nodes || [];

  if (nodes.length === 0) {
    children.push(createBodyText('No organizational structure defined.'));
  } else {
    children.push(...renderACNodesDocx(nodes));
  }

  return generateDocx(title, children);
}
