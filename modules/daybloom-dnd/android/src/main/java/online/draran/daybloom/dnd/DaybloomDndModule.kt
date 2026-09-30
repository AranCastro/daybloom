package online.draran.daybloom.dnd

import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DaybloomDndModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.AppContextLost()

  override fun definition() = ModuleDefinition {
    Name("DaybloomDnd")

    Function("hasAccess") { DndState.hasAccess(context) }

    Function("isActive") { DndState.isActive(context) }

    /** Opens the system page where the user allows Daybloom to change Do Not Disturb. */
    Function("openAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("start") { untilMs: Double -> DndState.start(context, untilMs.toLong()) }

    Function("stop") { DndState.stop(context) }
  }
}
