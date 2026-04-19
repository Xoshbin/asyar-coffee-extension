import type { Extension, ExtensionContext, CommandExecuteArgs } from 'asyar-sdk';
import { CoffeeController } from './lib/coffeeController';

class CoffeeExtension implements Extension {
  controller!: CoffeeController;
  private extensionManager!: any;

  async initialize(context: ExtensionContext): Promise<void> {
    this.extensionManager = context.getService('extensions');

    this.controller = new CoffeeController({
      storage: context.getService('storage'),
      statusBar: context.getService('statusBar'),
      power: context.getService('power'),
      timers: context.getService('timers'),
      application: context.getService('application'),
      systemEvents: context.getService('systemEvents'),
      preferences: context.preferences, // PreferencesFacade — has .values frozen snapshot
      notifier: context.getService('notifications'),
      now: () => Date.now(),
    });
  }

  async activate(): Promise<void> {
    await this.controller.activate();
  }

  async deactivate(): Promise<void> {
    await this.controller.deactivate();
  }

  async viewActivated(_viewId: string): Promise<void> {}
  async viewDeactivated(_viewId: string): Promise<void> {}

  async executeCommand(
    commandId: string,
    args?: CommandExecuteArgs,
  ): Promise<unknown> {
    const userArgs = (args?.arguments ?? {}) as Record<string, unknown>;

    switch (commandId) {
      case 'caffeinate':
        return this.controller.caffeinate();

      case 'decaffeinate':
        return this.controller.decaffeinate();

      case 'caffeinate-toggle':
        return this.controller.toggle();

      case 'caffeinate-for':
        return this.controller.caffeinateFor({
          hours: Number(userArgs.hours ?? 0),
          minutes: Number(userArgs.minutes ?? 0),
          seconds: Number(userArgs.seconds ?? 0),
        });

      case 'caffeinate-until':
        return this.controller.caffeinateUntil({
          time: String(userArgs.time ?? ''),
        });

      case 'caffeinate-while':
        this.extensionManager?.navigateToView(
          'org.asyar.coffee/CaffeinateWhileView',
        );
        return { type: 'view', viewPath: 'org.asyar.coffee/CaffeinateWhileView' };

      case 'status':
        return this.controller.emitStatusNotification();

      case 'index':
        this.controller.refreshTray();
        return { type: 'no-view' };

      default:
        return undefined;
    }
  }

  onUnload = () => {};
}

export default new CoffeeExtension();
