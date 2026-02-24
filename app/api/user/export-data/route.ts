import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all user data
    const [
      userData,
      userChats,
      userMessages,
      userDocuments,
      userUploadedDocs,
      calendarTokens,
    ] = await Promise.all([
      // User profile and settings
      db
        .select({
          // User fields
          id: schema.user.id,
          email: schema.user.email,
          providerId: schema.user.providerId,
          googleCalendarConnected: schema.user.googleCalendarConnected,
          lastFeaturesVersion: schema.user.lastFeaturesVersion,
          // UserSettings fields
          displayName: schema.userSettings.displayName,
          companyName: schema.userSettings.companyName,
          companyType: schema.userSettings.companyType,
          companyDescription: schema.userSettings.companyDescription,
          language: schema.userSettings.language,
          fontSize: schema.userSettings.fontSize,
          notificationsEnabled: schema.userSettings.notificationsEnabled,
          createdAt: schema.userSettings.createdAt,
          updatedAt: schema.userSettings.updatedAt,
        })
        .from(schema.user)
        .leftJoin(
          schema.userSettings,
          eq(schema.user.id, schema.userSettings.userId),
        )
        .where(eq(schema.user.id, userId)),

      // User chats
      db
        .select()
        .from(schema.chat)
        .where(eq(schema.chat.userId, userId)),

      // User messages (we'll fetch these separately for each chat to avoid huge joins)
      db
        .select({
          id: schema.message.id,
          chatId: schema.message.chatId,
          content: schema.message.parts,
          role: schema.message.role,
          createdAt: schema.message.createdAt,
        })
        .from(schema.message)
        .innerJoin(schema.chat, eq(schema.chat.id, schema.message.chatId))
        .where(eq(schema.chat.userId, userId)),

      // AI-generated documents
      db
        .select()
        .from(schema.document)
        .where(eq(schema.document.userId, userId)),

      // User-uploaded documents
      db
        .select()
        .from(schema.userDocuments)
        .where(eq(schema.userDocuments.userId, userId)),

      // Calendar integration data (tokens excluded for security)
      db
        .select({
          id: schema.googleCalendarToken.id,
          userId: schema.googleCalendarToken.userId,
          createdAt: schema.googleCalendarToken.createdAt,
          updatedAt: schema.googleCalendarToken.updatedAt,
        })
        .from(schema.googleCalendarToken)
        .where(eq(schema.googleCalendarToken.userId, userId)),
    ]);

    // Organize messages by chat
    const messagesByChat = userMessages.reduce(
      (acc, msg) => {
        if (!acc[msg.chatId]) {
          acc[msg.chatId] = [];
        }
        acc[msg.chatId].push(msg);
        return acc;
      },
      {} as Record<string, typeof userMessages>,
    );

    // Combine chats with their messages
    const chatsWithMessages = userChats.map((chat) => ({
      ...chat,
      messages: messagesByChat[chat.id] || [],
    }));

    // Prepare export data
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        profile: userData[0]
          ? {
              id: userData[0].id,
              email: userData[0].email,
              displayName: userData[0].displayName,
              companyName: userData[0].companyName,
              companyType: userData[0].companyType,
              companyDescription: userData[0].companyDescription,
              language: userData[0].language,
              fontSize: userData[0].fontSize,
              notificationsEnabled: userData[0].notificationsEnabled,
              createdAt: userData[0].createdAt,
              updatedAt: userData[0].updatedAt,
            }
          : null,
      },
      chats: {
        count: chatsWithMessages.length,
        data: chatsWithMessages.map((chat) => ({
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt,
          messageCount: chat.messages.length,
          messages: chat.messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
          })),
        })),
      },
      documents: {
        aiGenerated: {
          count: userDocuments.length,
          data: userDocuments.map((doc) => ({
            id: doc.id,
            title: doc.title,
            content: doc.content,
            kind: doc.kind,
            createdAt: doc.createdAt,
          })),
        },
        userUploaded: {
          count: userUploadedDocs.length,
          data: userUploadedDocs.map((doc) => ({
            id: doc.id,
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
            category: doc.category,
            content: doc.content,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          })),
        },
      },
      integrations: {
        googleCalendar: {
          connected: calendarTokens.length > 0,
          connectionDate: calendarTokens[0]?.createdAt || null,
        },
      },
      statistics: {
        totalChats: chatsWithMessages.length,
        totalMessages: userMessages.length,
        totalDocuments: userDocuments.length + userUploadedDocs.length,
        accountAge: userData[0]?.createdAt
          ? Math.floor(
              (Date.now() - new Date(userData[0].createdAt).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 0,
      },
    };

    // Create filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `eos-ai-data-export-${timestamp}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    return NextResponse.json(
      { error: 'Failed to export user data' },
      { status: 500 },
    );
  }
}
