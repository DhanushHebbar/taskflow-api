const cron = require('node-cron');
const nodemailer = require('nodemailer');

const Task = require('../models/Task');
const Notification = require('../models/Notification');

// SMTP Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Email sender helper
const sendDeadlineEmail = async (userEmail, taskTitle) => {
  try {
    await transporter.sendMail({
      from: '"TaskFlow Alerts" <noreply@taskflow.com>',
      to: userEmail,
      subject: `🚨 Urgent: Task Overdue - ${taskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color:#ef4444;">Task Deadline Alert</h2>

          <p>
            Your task
            <strong>${taskTitle}</strong>
            is due within 24 hours.
          </p>

          <p>
            Please review and update the task status in TaskFlow.
          </p>

          <hr />

          <small>
            This is an automated TaskFlow notification.
          </small>
        </div>
      `
    });

    console.log(`[Email Sent] ${userEmail}`);
  } catch (err) {
    console.error('[Email Error]', err.message);
  }
};

// Start Watchdog
const startWatchdog = (io) => {
  console.log('🐕 Deadline Watchdog initialized. Monitoring tasks...');

  // Runs every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();

      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);

      // Find urgent tasks
      const urgentTasks = await Task.find({
        dueDate: { $lte: tomorrow, $gte: now },
        status: { $ne: 'Completed' },
        isNotified: false
      })
      .populate('assignedTo')
      .populate('createdBy');

      if (urgentTasks.length > 0) {
        console.log(
          `[Watchdog] Found ${urgentTasks.length} urgent tasks`
        );
      }

      for (let task of urgentTasks) {

        // Assigned user OR creator
        const userToNotify =
          task.assignedTo || task.createdBy;

        // Skip if email missing
        if (!userToNotify?.email) continue;

        // Create in-app notification
        const notif = new Notification({
          user: userToNotify._id,
          message: `🚨 URGENT: The task "${task.title}" is due within 24 hours!`
        });

        await notif.save();

        // Send Email
        await sendDeadlineEmail(
          userToNotify.email,
          task.title
        );

        // Prevent duplicate spam
        task.isNotified = true;

        await task.save();

        // Real-time frontend toast
        if (io) {
          io.to(userToNotify._id.toString())
            .emit('new_notification', notif);
        }
      }

    } catch (err) {
      console.error('Watchdog Error:', err);
    }
  });
};

module.exports = startWatchdog;
