package online.draran.daybloom.dnd

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Fired at the end of a focus session: turns Do Not Disturb back off (see DndState). */
class DndRestoreReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    DndState.stop(context)
  }
}
