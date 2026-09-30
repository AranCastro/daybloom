package online.draran.daybloom.dnd

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Do Not Disturb for focus sessions. Remembers the filter that was on before, so ending the
 * session restores exactly that (and never touches a Do Not Disturb the user set themselves).
 */
object DndState {
  private const val PREFS = "daybloom_dnd"
  private const val KEY_ACTIVE = "active"
  private const val KEY_PREVIOUS = "previous"
  private const val REQUEST_CODE = 4107

  private fun nm(ctx: Context) = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun hasAccess(ctx: Context): Boolean = nm(ctx).isNotificationPolicyAccessGranted

  fun isActive(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_ACTIVE, false)

  /** Turns on priority-only Do Not Disturb until [untilMs] (epoch ms). Returns false without access. */
  fun start(ctx: Context, untilMs: Long): Boolean {
    val manager = nm(ctx)
    if (!manager.isNotificationPolicyAccessGranted) return false
    val current = manager.currentInterruptionFilter
    // Already silent by the user's own choice: leave it alone and do not restore anything later.
    if (!isActive(ctx) && current != NotificationManager.INTERRUPTION_FILTER_ALL) return false
    if (!isActive(ctx)) prefs(ctx).edit().putBoolean(KEY_ACTIVE, true).putInt(KEY_PREVIOUS, current).apply()
    manager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
    scheduleRestore(ctx, untilMs)
    return true
  }

  /** Puts back the filter from before the session, if this app turned Do Not Disturb on. */
  fun stop(ctx: Context) {
    cancelRestore(ctx)
    if (!isActive(ctx)) return
    val previous = prefs(ctx).getInt(KEY_PREVIOUS, NotificationManager.INTERRUPTION_FILTER_ALL)
    prefs(ctx).edit().clear().apply()
    val manager = nm(ctx)
    if (!manager.isNotificationPolicyAccessGranted) return
    // Only undo our own change: if the user changed it during the session, keep theirs.
    if (manager.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_PRIORITY) {
      manager.setInterruptionFilter(previous)
    }
  }

  private fun restoreIntent(ctx: Context): PendingIntent =
    PendingIntent.getBroadcast(
      ctx,
      REQUEST_CODE,
      Intent(ctx, DndRestoreReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun scheduleRestore(ctx: Context, untilMs: Long) {
    val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pending = restoreIntent(ctx)
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()
    if (exact) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, untilMs, pending)
    else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, untilMs, pending)
  }

  private fun cancelRestore(ctx: Context) {
    val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarms.cancel(restoreIntent(ctx))
  }
}
