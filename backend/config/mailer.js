const nodemailer = require('nodemailer');
const config = require('./validateEnv');
const logger = require('./logger');

let transporter = null;

// Initialize the mail transporter
function getTransporter() {
  if (transporter) return transporter;

  const hasCredentials = config.SMTP_USER && config.SMTP_PASS;

  if (hasCredentials) {
    logger.info('Initializing SMTP mail transporter with configured credentials', {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      user: config.SMTP_USER,
    });
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
  } else {
    logger.warn('SMTP credentials not configured. Mailer will run in LOG-ONLY mode (emails will print to logger/console).');
    transporter = {
      sendMail: async (mailOptions) => {
        logger.info('📬 [MAIL LOG (LOG-ONLY MODE)] Email simulated:', {
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text,
          html: mailOptions.html,
        });
        return { messageId: 'simulated-id-' + Date.now() };
      }
    };
  }

  return transporter;
}

/**
 * Send an email.
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.text
 * @param {string} options.html
 */
async function sendEmail({ to, subject, text, html }) {
  try {
    const mailer = getTransporter();
    const mailOptions = {
      from: `"${config.EMAIL_FROM.split('@')[0]}" <${config.EMAIL_FROM}>`,
      to,
      subject,
      text,
      html,
    };

    const info = await mailer.sendMail(mailOptions);
    logger.info('Email sent successfully', { messageId: info.messageId, to });
    return info;
  } catch (error) {
    logger.error('Failed to send email', { error: error.message, to });
    throw error;
  }
}

module.exports = {
  sendEmail,
};
