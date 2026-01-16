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
  addTable,
  addFooter,
  pdfToBuffer,
} from '@/lib/export/pdf-generator';
import {
  createTitle,
  createSubtitle,
  createHeading,
  createBodyText,
  createBulletList,
  createTable,
  generateDocx,
} from '@/lib/export/docx-generator';
import type { Paragraph, Table } from 'docx';

// VTO data structure
interface VTOData {
  coreValues?: string[];
  coreFocus?: {
    purpose?: string;
    niche?: string;
  };
  tenYearTarget?: string;
  marketingStrategy?: {
    targetMarket?: string;
    threeUniques?: string[];
    provenProcess?: string;
    guarantee?: string;
  };
  threeYearPicture?: {
    revenue?: string;
    profit?: string;
    measurables?: string[];
    whatLooksLike?: string;
  };
  oneYearPlan?: {
    revenue?: string;
    profit?: string;
    measurables?: string[];
    goals?: string[];
  };
  quarterlyRocks?: Array<{
    rock: string;
    owner?: string;
    status?: string;
  }>;
  issues?: string[];
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

    // Check monthly export limit if applicable
    const monthlyLimit = 10; // You can make this configurable
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

    // Fetch the VTO document
    const [vtoDoc] = await db
      .select()
      .from(document)
      .where(
        and(
          eq(document.id, documentId),
          eq(document.userId, session.user.id),
          eq(document.kind, 'vto'),
        ),
      )
      .limit(1);

    if (!vtoDoc) {
      return NextResponse.json(
        { error: 'VTO document not found' },
        { status: 404 },
      );
    }

    // Extract VTO data
    const content = vtoDoc.content || '';
    const vtoMatch = content.match(/VTO_DATA_BEGIN\n([\s\S]*?)\nVTO_DATA_END/);

    if (!vtoMatch) {
      return NextResponse.json(
        { error: 'Invalid VTO document format' },
        { status: 400 },
      );
    }

    const vtoData = JSON.parse(vtoMatch[1]);

    // Increment usage counter
    await incrementUsageCounter(session.user.id, 'exports_month', 1);

    if (format === 'json') {
      // Return raw VTO data as JSON
      return NextResponse.json({
        title: vtoDoc.title,
        createdAt: vtoDoc.createdAt,
        data: vtoData,
      });
    }

    // Generate PDF export
    if (format === 'pdf') {
      const pdfBuffer = generateVTOPdf(
        vtoData,
        vtoDoc.title || 'Vision/Traction Organizer',
      );
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${vtoDoc.title || 'VTO'}.pdf"`,
        },
      });
    }

    // Generate DOCX export
    if (format === 'docx') {
      const docxBuffer = await generateVTODocx(
        vtoData,
        vtoDoc.title || 'Vision/Traction Organizer',
      );
      return new NextResponse(new Uint8Array(docxBuffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${vtoDoc.title || 'VTO'}.docx"`,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid export format' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[export.vto] Export failed', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

/**
 * Generate PDF for VTO document
 */
function generateVTOPdf(vtoData: VTOData, title: string): Buffer {
  const doc = createPDF(title);
  let y = addHeader(doc, 'Vision/Traction Organizer™', title);

  // Core Values
  if (vtoData.coreValues?.length) {
    y = addSectionHeading(doc, 'Core Values', y);
    y = addBulletList(doc, vtoData.coreValues, y);
    y += 5;
  }

  // Core Focus
  if (vtoData.coreFocus) {
    y = addSectionHeading(doc, 'Core Focus™', y);
    if (vtoData.coreFocus.purpose) {
      y = addBodyText(
        doc,
        `Purpose/Cause/Passion: ${vtoData.coreFocus.purpose}`,
        y,
      );
    }
    if (vtoData.coreFocus.niche) {
      y = addBodyText(doc, `Our Niche: ${vtoData.coreFocus.niche}`, y);
    }
    y += 5;
  }

  // 10-Year Target
  if (vtoData.tenYearTarget) {
    y = addSectionHeading(doc, '10-Year Target™', y);
    y = addBodyText(doc, vtoData.tenYearTarget, y);
    y += 5;
  }

  // Marketing Strategy
  if (vtoData.marketingStrategy) {
    y = addSectionHeading(doc, 'Marketing Strategy', y);
    if (vtoData.marketingStrategy.targetMarket) {
      y = addBodyText(
        doc,
        `Target Market: ${vtoData.marketingStrategy.targetMarket}`,
        y,
      );
    }
    if (vtoData.marketingStrategy.threeUniques?.length) {
      y = addBodyText(doc, '3 Uniques™:', y);
      y = addBulletList(doc, vtoData.marketingStrategy.threeUniques, y);
    }
    if (vtoData.marketingStrategy.provenProcess) {
      y = addBodyText(
        doc,
        `Proven Process: ${vtoData.marketingStrategy.provenProcess}`,
        y,
      );
    }
    if (vtoData.marketingStrategy.guarantee) {
      y = addBodyText(
        doc,
        `Guarantee: ${vtoData.marketingStrategy.guarantee}`,
        y,
      );
    }
    y += 5;
  }

  // 3-Year Picture
  if (vtoData.threeYearPicture) {
    y = addSectionHeading(doc, '3-Year Picture™', y);
    if (vtoData.threeYearPicture.revenue) {
      y = addBodyText(doc, `Revenue: ${vtoData.threeYearPicture.revenue}`, y);
    }
    if (vtoData.threeYearPicture.profit) {
      y = addBodyText(doc, `Profit: ${vtoData.threeYearPicture.profit}`, y);
    }
    if (vtoData.threeYearPicture.measurables?.length) {
      y = addBodyText(doc, 'Key Measurables:', y);
      y = addBulletList(doc, vtoData.threeYearPicture.measurables, y);
    }
    if (vtoData.threeYearPicture.whatLooksLike) {
      y = addBodyText(
        doc,
        `What Does It Look Like: ${vtoData.threeYearPicture.whatLooksLike}`,
        y,
      );
    }
    y += 5;
  }

  // 1-Year Plan
  if (vtoData.oneYearPlan) {
    y = addSectionHeading(doc, '1-Year Plan', y);
    if (vtoData.oneYearPlan.revenue) {
      y = addBodyText(doc, `Revenue Goal: ${vtoData.oneYearPlan.revenue}`, y);
    }
    if (vtoData.oneYearPlan.profit) {
      y = addBodyText(doc, `Profit Goal: ${vtoData.oneYearPlan.profit}`, y);
    }
    if (vtoData.oneYearPlan.goals?.length) {
      y = addBodyText(doc, 'Goals:', y);
      y = addBulletList(doc, vtoData.oneYearPlan.goals, y);
    }
    y += 5;
  }

  // Quarterly Rocks
  if (vtoData.quarterlyRocks?.length) {
    y = addSectionHeading(doc, 'Quarterly Rocks', y);
    y = addTable(
      doc,
      {
        headers: ['Rock', 'Owner', 'Status'],
        rows: vtoData.quarterlyRocks.map((r) => ({
          cells: [r.rock, r.owner || '', r.status || 'On Track'],
        })),
      },
      y,
      { columnWidths: [100, 40, 30] },
    );
    y += 5;
  }

  // Issues List
  if (vtoData.issues?.length) {
    y = addSectionHeading(doc, 'Issues List', y);
    y = addBulletList(doc, vtoData.issues, y);
  }

  addFooter(doc, 'EOS AI - Vision/Traction Organizer');
  return pdfToBuffer(doc);
}

/**
 * Generate DOCX for VTO document
 */
async function generateVTODocx(
  vtoData: VTOData,
  title: string,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(createSubtitle('Vision/Traction Organizer™'));

  // Core Values
  if (vtoData.coreValues?.length) {
    children.push(createHeading('Core Values'));
    children.push(...createBulletList(vtoData.coreValues));
  }

  // Core Focus
  if (vtoData.coreFocus) {
    children.push(createHeading('Core Focus™'));
    if (vtoData.coreFocus.purpose) {
      children.push(
        createBodyText(`Purpose/Cause/Passion: ${vtoData.coreFocus.purpose}`),
      );
    }
    if (vtoData.coreFocus.niche) {
      children.push(createBodyText(`Our Niche: ${vtoData.coreFocus.niche}`));
    }
  }

  // 10-Year Target
  if (vtoData.tenYearTarget) {
    children.push(createHeading('10-Year Target™'));
    children.push(createBodyText(vtoData.tenYearTarget));
  }

  // Marketing Strategy
  if (vtoData.marketingStrategy) {
    children.push(createHeading('Marketing Strategy'));
    if (vtoData.marketingStrategy.targetMarket) {
      children.push(
        createBodyText(
          `Target Market: ${vtoData.marketingStrategy.targetMarket}`,
        ),
      );
    }
    if (vtoData.marketingStrategy.threeUniques?.length) {
      children.push(createHeading('3 Uniques™', 2));
      children.push(
        ...createBulletList(vtoData.marketingStrategy.threeUniques),
      );
    }
    if (vtoData.marketingStrategy.provenProcess) {
      children.push(
        createBodyText(
          `Proven Process: ${vtoData.marketingStrategy.provenProcess}`,
        ),
      );
    }
    if (vtoData.marketingStrategy.guarantee) {
      children.push(
        createBodyText(`Guarantee: ${vtoData.marketingStrategy.guarantee}`),
      );
    }
  }

  // 3-Year Picture
  if (vtoData.threeYearPicture) {
    children.push(createHeading('3-Year Picture™'));
    if (vtoData.threeYearPicture.revenue) {
      children.push(
        createBodyText(`Revenue: ${vtoData.threeYearPicture.revenue}`),
      );
    }
    if (vtoData.threeYearPicture.profit) {
      children.push(
        createBodyText(`Profit: ${vtoData.threeYearPicture.profit}`),
      );
    }
    if (vtoData.threeYearPicture.measurables?.length) {
      children.push(createHeading('Key Measurables', 2));
      children.push(...createBulletList(vtoData.threeYearPicture.measurables));
    }
    if (vtoData.threeYearPicture.whatLooksLike) {
      children.push(
        createBodyText(
          `What Does It Look Like: ${vtoData.threeYearPicture.whatLooksLike}`,
        ),
      );
    }
  }

  // 1-Year Plan
  if (vtoData.oneYearPlan) {
    children.push(createHeading('1-Year Plan'));
    if (vtoData.oneYearPlan.revenue) {
      children.push(
        createBodyText(`Revenue Goal: ${vtoData.oneYearPlan.revenue}`),
      );
    }
    if (vtoData.oneYearPlan.profit) {
      children.push(
        createBodyText(`Profit Goal: ${vtoData.oneYearPlan.profit}`),
      );
    }
    if (vtoData.oneYearPlan.goals?.length) {
      children.push(createHeading('Goals', 2));
      children.push(...createBulletList(vtoData.oneYearPlan.goals));
    }
  }

  // Quarterly Rocks
  if (vtoData.quarterlyRocks?.length) {
    children.push(createHeading('Quarterly Rocks'));
    children.push(
      createTable({
        headers: ['Rock', 'Owner', 'Status'],
        rows: vtoData.quarterlyRocks.map((r) => [
          r.rock,
          r.owner || '',
          r.status || 'On Track',
        ]),
      }),
    );
  }

  // Issues List
  if (vtoData.issues?.length) {
    children.push(createHeading('Issues List'));
    children.push(...createBulletList(vtoData.issues));
  }

  return generateDocx(title, children);
}
