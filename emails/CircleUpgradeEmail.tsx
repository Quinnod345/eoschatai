import * as React from 'react';

type CircleUpgradeEmailProps = {
  toEmail: string;
  memberName?: string | null;
  tierName: string;
  appLink: string;
};

export default function CircleUpgradeEmail({
  toEmail,
  memberName,
  tierName,
  appLink,
}: CircleUpgradeEmailProps) {
  const brand = 'EOS AI';
  const greetingName = memberName?.trim() || 'there';
  const base =
    typeof window === 'undefined'
      ? (
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.APP_URL ||
          'https://app.local'
        ).replace(/\/$/, '')
      : '';
  const logoUrl = `${base}/images/eos-logo.png`;

  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Your Plan Has Been Upgraded</title>
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#f4f9fc',
          fontFamily:
            "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          color: '#09243f',
        }}
      >
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: '#f4f9fc' }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: '36px 20px' }}>
                <table
                  role="presentation"
                  width="600"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 16,
                    border: '1px solid #c1d2e0',
                    overflow: 'hidden',
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          height: 4,
                          background:
                            'linear-gradient(90deg, #ff8c00 0%, #ff9f1a 100%)',
                        }}
                      />
                    </tr>
                    <tr>
                      <td style={{ padding: '32px 40px 24px' }}>
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                          <img
                            src={logoUrl}
                            width={40}
                            height={40}
                            alt="EOS AI"
                            style={{ borderRadius: 8 }}
                          />
                          <h1
                            style={{
                              margin: '12px 0 0',
                              fontSize: 24,
                              lineHeight: '32px',
                              fontWeight: 700,
                            }}
                          >
                            Your Plan Has Been Upgraded
                          </h1>
                        </div>

                        <p
                          style={{
                            margin: '0 0 16px',
                            fontSize: 16,
                            lineHeight: '24px',
                            color: '#476581',
                          }}
                        >
                          Hi {greetingName},
                        </p>
                        <p
                          style={{
                            margin: '0 0 16px',
                            fontSize: 16,
                            lineHeight: '24px',
                            color: '#476581',
                          }}
                        >
                          Great news! Your Circle community upgrade has been
                          synced to your {brand} account. Your account{' '}
                          <strong style={{ color: '#09243f' }}>{toEmail}</strong>{' '}
                          is now on the{' '}
                          <strong style={{ color: '#09243f' }}>{tierName}</strong>{' '}
                          tier.
                        </p>
                        <p
                          style={{
                            margin: '0 0 24px',
                            fontSize: 16,
                            lineHeight: '24px',
                            color: '#476581',
                          }}
                        >
                          You can log in with your existing credentials to start
                          using your new features right away.
                        </p>

                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                          <a
                            href={appLink}
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#ff8c00',
                              color: '#ffffff',
                              textDecoration: 'none',
                              borderRadius: 8,
                              padding: '12px 22px',
                              fontWeight: 600,
                              fontSize: 14,
                            }}
                          >
                            Go to {brand}
                          </a>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p
                  style={{
                    margin: '16px 0 0',
                    fontSize: 12,
                    lineHeight: '18px',
                    color: '#476581',
                  }}
                >
                  © {new Date().getFullYear()} EOS AI. All rights reserved.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
