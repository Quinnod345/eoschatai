import * as React from 'react';

type OrgInviteEmailProps = {
  toEmail: string;
  orgName: string;
  inviteLink: string;
  invitedByName?: string;
};

export default function OrgInviteEmail({
  toEmail,
  orgName,
  inviteLink,
  invitedByName,
}: OrgInviteEmailProps) {
  const brand = 'EOS AI';
  const preheader = `${invitedByName || 'A teammate'} invited you to join ${orgName}`;
  const base =
    typeof window === 'undefined'
      ? (
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.APP_URL ||
          'https://app.local'
        ).replace(/\/$/, '')
      : '';
  const logoUrl = `${base}/images/eos-logo.png`;

  // Match app's color scheme
  const colors = {
    background: '#f4f9fc', // --background: 210 48% 97%
    foreground: '#09243f', // --foreground: 210 100% 18%
    primary: '#ff8c00', // --primary: 29 100% 50%
    primaryHover: '#e67e00', // slightly darker
    muted: '#dee8ef', // --muted: 210 30% 90%
    mutedForeground: '#476581', // --muted-foreground: 210 40% 40%
    border: '#c1d2e0', // --border: 210 20% 85%
    cardBg: '#ffffff',
  };

  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${orgName} Invitation - EOS AI`}</title>
      </head>
      <body
        style={{
          backgroundColor: colors.background,
          margin: 0,
          padding: 0,
          fontFamily:
            "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          color: colors.foreground,
          lineHeight: 1.5,
        }}
      >
        {/* Preheader */}
        <div
          style={{
            display: 'none',
            overflow: 'hidden',
            lineHeight: '1px',
            opacity: 0,
            maxHeight: 0,
            maxWidth: 0,
          }}
        >
          {preheader}
        </div>

        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: colors.background }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: '40px 20px' }}>
                {/* Logo Header */}
                <table
                  role="presentation"
                  width="600"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ marginBottom: 32 }}
                >
                  <tbody>
                    <tr>
                      <td align="center">
                        <img
                          src={logoUrl}
                          width={40}
                          height={40}
                          alt="EOS AI"
                          style={{
                            borderRadius: 8,
                          }}
                        />
                        <h1
                          style={{
                            margin: '16px 0 0 0',
                            fontSize: 24,
                            fontWeight: 700,
                            color: colors.foreground,
                          }}
                        >
                          {brand}
                        </h1>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Main Card */}
                <table
                  role="presentation"
                  width="600"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{
                    backgroundColor: colors.cardBg,
                    borderRadius: 16,
                    border: `1px solid ${colors.border}`,
                    boxShadow:
                      '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.05)',
                    overflow: 'hidden',
                  }}
                >
                  <tbody>
                    <tr>
                      <td>
                        {/* Orange accent bar */}
                        <div
                          style={{
                            height: 4,
                            background: `linear-gradient(90deg, ${colors.primary} 0%, #ff9f1a 100%)`,
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '40px 48px' }}>
                        {/* Icon */}
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                          <div
                            style={{
                              display: 'inline-block',
                              width: 64,
                              height: 64,
                              borderRadius: 16,
                              backgroundColor: '#fff7ed',
                              border: '1px solid #fed7aa',
                              position: 'relative',
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontSize: 28,
                              }}
                            >
                              🏢
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <h2
                          style={{
                            margin: '0 0 16px 0',
                            fontSize: 28,
                            fontWeight: 700,
                            textAlign: 'center',
                            color: colors.foreground,
                          }}
                        >
                          You're invited to join {orgName}
                        </h2>

                        {/* Description */}
                        <p
                          style={{
                            margin: '0 0 32px 0',
                            fontSize: 16,
                            color: colors.mutedForeground,
                            textAlign: 'center',
                            lineHeight: '24px',
                          }}
                        >
                          {invitedByName ? (
                            <>
                              <strong style={{ color: colors.foreground }}>
                                {invitedByName}
                              </strong>{' '}
                              has invited you to collaborate in the{' '}
                              <strong style={{ color: colors.foreground }}>
                                {orgName}
                              </strong>{' '}
                              organization on EOS AI.
                            </>
                          ) : (
                            <>
                              You've been invited to join the{' '}
                              <strong style={{ color: colors.foreground }}>
                                {orgName}
                              </strong>{' '}
                              organization on EOS AI.
                            </>
                          )}
                        </p>

                        {/* CTA Button */}
                        <div style={{ textAlign: 'center', marginBottom: 32 }}>
                          <a
                            href={inviteLink}
                            style={{
                              display: 'inline-block',
                              backgroundColor: colors.primary,
                              color: '#ffffff',
                              textDecoration: 'none',
                              padding: '12px 24px',
                              borderRadius: 8,
                              fontWeight: 600,
                              fontSize: 14,
                              transition: 'all 0.2s',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                            }}
                          >
                            Accept Invitation
                          </a>
                        </div>

                        {/* Features */}
                        <div
                          style={{
                            backgroundColor: colors.background,
                            borderRadius: 12,
                            padding: 24,
                            marginBottom: 24,
                          }}
                        >
                          <p
                            style={{
                              margin: '0 0 16px 0',
                              fontSize: 14,
                              fontWeight: 600,
                              color: colors.foreground,
                            }}
                          >
                            As a member of {orgName}, you'll get access to:
                          </p>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: 20,
                              fontSize: 14,
                              color: colors.mutedForeground,
                            }}
                          >
                            <li style={{ marginBottom: 8 }}>
                              Shared team workspace and resources
                            </li>
                            <li style={{ marginBottom: 8 }}>
                              Organization-wide AI personas and configurations
                            </li>
                            <li style={{ marginBottom: 8 }}>
                              Premium features included in your team's plan
                            </li>
                            <li>
                              Collaborative document generation and sharing
                            </li>
                          </ul>
                        </div>

                        {/* Footer text */}
                        <div
                          style={{
                            fontSize: 13,
                            color: colors.mutedForeground,
                            textAlign: 'center',
                            lineHeight: '20px',
                          }}
                        >
                          <p style={{ margin: '0 0 8px 0' }}>
                            This invitation link will expire in 7 days.
                          </p>
                          <p style={{ margin: '0 0 16px 0' }}>
                            If you're having trouble with the button above, copy
                            and paste this URL into your browser:
                          </p>
                          <p
                            style={{
                              margin: 0,
                              wordBreak: 'break-all',
                              color: colors.primary,
                            }}
                          >
                            <a
                              href={inviteLink}
                              style={{
                                color: colors.primary,
                                textDecoration: 'none',
                              }}
                            >
                              {inviteLink}
                            </a>
                          </p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Footer */}
                <table
                  role="presentation"
                  width="600"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ marginTop: 32 }}
                >
                  <tbody>
                    <tr>
                      <td
                        align="center"
                        style={{
                          fontSize: 12,
                          color: colors.mutedForeground,
                        }}
                      >
                        <p style={{ margin: '0 0 4px 0' }}>
                          © {new Date().getFullYear()} EOS AI. All rights
                          reserved.
                        </p>
                        <p style={{ margin: 0 }}>
                          If you didn't request this invitation, you can safely
                          ignore this email.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
