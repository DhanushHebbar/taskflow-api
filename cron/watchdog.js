const cron = require('node-cron');
const Task = require('../models/Task');
const Notification = require('../models/Notification');

// This function will be called once when the server starts
const startWatchdog = (io) => {
  console.log('🐕 Deadline Watchdog initialized. Monitoring tasks...');

  // Schedule to run every hour ('0 * * * *')
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);

      // Find tasks due within 24 hours, not completed, and not yet notified
      const urgentTasks = await Task.find({
        dueDate: { $lte: tomorrow, $gte: now },
        status: { $ne: 'Completed' },
        isNotified: false
      });

      if (urgentTasks.length > 0) {
        console.log(`[Watchdog] Found ${urgentTasks.length} urgent tasks. Dispatching notifications...`);
      }

      for (let task of urgentTasks) {
        // Notify the assigned user (or the creator if unassigned)
        const userToNotify = task.assignedTo || task.createdBy;
        
        const notif = new Notification({
          user: userToNotify,
          message: `🚨 URGENT: The task "${task.title}" is due within 24 hours!`
        });
        await notif.save();

        // Mark as notified to prevent duplicate spam
        task.isNotified = true;
        await task.save();

        // Push real-time toast to the frontend
        if (io) {
          io.to(userToNotify.toString()).emit('new_notification', notif);
        }
      }
    } catch (err) {
      console.error('Watchdog Error:', err);
    }
  });
};

module.exports = startWatchdog;
