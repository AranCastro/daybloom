package online.draran.daybloom.dnd

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * A restart of the phone, or an update of the app, clears the alarm that ends a focus session's
 * Do Not Disturb: end it now if the session is over, or set the alarm again (see DndState).
 */
class DndBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> DndState.resume(context)
    }
  }
}
