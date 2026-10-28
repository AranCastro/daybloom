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
 * The end time is saved too, so a restart of the phone or of the app cannot leave it on
 * (DndBootReceiver).
 */
object DndState {
  private const val PREFS = "daybloom_dnd"
  private const val KEY_ACTIVE = "active"
  private const val KEY_PREVIOUS = "previous"
  private const val KEY_UNTIL = "until"
  private const val REQUEST_CODE = 4107
  /** A second, Doze-friendly alarm for when exact alarms are not allowed. */
  private const val REQUEST_CODE_IDLE = 4108
  /** How late the restore may come when exact alarms are not allowed (Android's shortest inexact window). */
  private const val WINDOW_MS = 600_000L

  private fun nm(ctx: Context) = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun hasAccess(ctx: Context): Boolean = nm(ctx).isNotificationPolicyAccessGranted

  fun isActive(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_ACTIVE, false)

  /** Turns on priority-only Do Not Disturb until [untilMs] (epoch ms). Returns false without access. */
  fun start(ctx: Context, untilMs: Long): Boolean {
    val manager = nm(ctx)
    if (!manager.isNotificationPolicyAccessGranted) return false
    val current = manager.currentInterruptionFilter
    if (isActive(ctx)) {
      // Turned off (or changed) by the user during the session: their choice stands.
      if (current != NotificationManager.INTERRUPTION_FILTER_PRIORITY) {
        clear(ctx)
        return false
      }
      prefs(ctx).edit().putLong(KEY_UNTIL, untilMs).apply()
      scheduleRestore(ctx, untilMs)
      return true
    }
    // Already silent by the user's own choice: leave it alone and do not restore anything later.
    if (current != NotificationManager.INTERRUPTION_FILTER_ALL) return false
    prefs(ctx).edit().putBoolean(KEY_ACTIVE, true).putInt(KEY_PREVIOUS, current).putLong(KEY_UNTIL, untilMs).apply()
    manager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
    scheduleRestore(ctx, untilMs)
    return true
  }

  /** Puts back the filter from before the session, if this app turned Do Not Disturb on. */
  fun stop(ctx: Context) {
    cancelRestore(ctx)
    if (!isActive(ctx)) return
    val manager = nm(ctx)
    // Without access nothing can be put back now; keep the record so a later stop (once access is
    // given again, or at the next launch) still can.
    if (!manager.isNotificationPolicyAccessGranted) return
    val previous = prefs(ctx).getInt(KEY_PREVIOUS, NotificationManager.INTERRUPTION_FILTER_ALL)
    clear(ctx)
    // Only undo our own change: if the user changed it during the session, keep theirs.
    if (manager.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_PRIORITY) {
      manager.setInterruptionFilter(previous)
    }
  }

  /**
   * After a reboot or an app update the restore alarm is gone: end the session's Do Not Disturb if
   * its time has passed, or set the alarm again.
   */
  fun resume(ctx: Context) {
    if (!isActive(ctx)) return
    val until = prefs(ctx).getLong(KEY_UNTIL, 0L)
    if (until <= System.currentTimeMillis()) stop(ctx) else scheduleRestore(ctx, until)
  }

  private fun clear(ctx: Context) {
    cancelRestore(ctx)
    prefs(ctx).edit().clear().apply()
  }

  private fun restoreIntent(ctx: Context, code: Int): PendingIntent =
    PendingIntent.getBroadcast(
      ctx,
      code,
      Intent(ctx, DndRestoreReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun scheduleRestore(ctx: Context, untilMs: Long) {
    val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()
    if (exact) {
      alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, untilMs, restoreIntent(ctx, REQUEST_CODE))
      return
    }
    // Exact alarms are off by default on Android 14+. A ten-minute window (the shortest Android
    // allows without them) keeps the restore close to the end while the phone is awake; the idle
    // alarm still fires if the phone is dozing. The app also restores it whenever it is opened.
    alarms.setWindow(AlarmManager.RTC_WAKEUP, untilMs, WINDOW_MS, restoreIntent(ctx, REQUEST_CODE))
    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, untilMs, restoreIntent(ctx, REQUEST_CODE_IDLE))
  }

  private fun cancelRestore(ctx: Context) {
    val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarms.cancel(restoreIntent(ctx, REQUEST_CODE))
    alarms.cancel(restoreIntent(ctx, REQUEST_CODE_IDLE))
  }
}
