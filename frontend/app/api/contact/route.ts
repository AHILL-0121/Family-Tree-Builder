import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { name, email, message } = await request.json();

    // Validate input
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    // Create transporter with SMTP credentials
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Email content
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: "sa.education5211@gmail.com", // Send to recipient email
      replyTo: email,
      subject: `Family Tree Generator - Contact from ${name}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0fdf4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ecfdf5 0%, #fef3c7 100%); padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1); overflow: hidden;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px 40px; text-align: center;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 12px; display: inline-block; line-height: 60px;">
                              <span style="font-size: 30px;">🌳</span>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top: 15px;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Family Tree Generator</h1>
                            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">New Contact Message</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Notification Badge -->
                  <tr>
                    <td style="padding: 30px 40px 0 40px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border-left: 4px solid #f59e0b;">
                        <tr>
                          <td style="padding: 16px 20px;">
                            <table cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding-right: 12px;">
                                  <span style="font-size: 20px;">✉️</span>
                                </td>
                                <td>
                                  <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">You've received a new message!</p>
                                  <p style="margin: 4px 0 0 0; color: #a16207; font-size: 12px;">Sent on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Sender Info -->
                  <tr>
                    <td style="padding: 30px 40px 0 40px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; overflow: hidden;">
                        <tr>
                          <td style="padding: 20px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td width="50" valign="top">
                                  <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; text-align: center; line-height: 50px;">
                                    <span style="color: white; font-size: 20px; font-weight: 600;">${name.charAt(0).toUpperCase()}</span>
                                  </div>
                                </td>
                                <td style="padding-left: 15px;" valign="middle">
                                  <h3 style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">${name}</h3>
                                  <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">
                                    <a href="mailto:${email}" style="color: #059669; text-decoration: none;">${email}</a>
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Message Content -->
                  <tr>
                    <td style="padding: 30px 40px;">
                      <h2 style="margin: 0 0 15px 0; color: #374151; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                        <span style="display: inline-block; width: 4px; height: 16px; background-color: #059669; margin-right: 10px; vertical-align: middle; border-radius: 2px;"></span>
                        Message
                      </h2>
                      <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
                        <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${message}</p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Action Button -->
                  <tr>
                    <td style="padding: 0 40px 30px 40px;" align="center">
                      <a href="mailto:${email}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.4);">
                        Reply to ${name}
                      </a>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 25px 40px; border-top: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                              This message was sent from the 
                              <a href="#" style="color: #059669; text-decoration: none; font-weight: 500;">Family Tree Generator</a> 
                              contact form.
                            </p>
                            <p style="margin: 10px 0 0 0; color: #d1d5db; font-size: 11px;">
                              🌳 Helping families preserve their heritage
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                </table>
                
                <!-- Bottom Branding -->
                <table width="600" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding: 25px;">
                      <p style="margin: 0; color: #6b7280; font-size: 11px;">
                        © ${new Date().getFullYear()} Family Tree Generator by 
                        <a href="https://github.com/AHILL-0121" style="color: #059669; text-decoration: none;">AHILL-0121</a>
                      </p>
                    </td>
                  </tr>
                </table>
                
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { message: "Email sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
