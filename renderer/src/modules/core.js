import LocaleManager from "./localemanager";

import Logger from "common/logger";
import {Config, Changelog} from "data";
import DOMManager from "./dommanager";
import PluginManager from "./pluginmanager";
import ThemeManager from "./thememanager";
import Settings from "./settingsmanager";
import * as Builtins from "builtins";
import Modals from "../ui/modals";
import DataStore from "./datastore";
import DiscordModules from "./discordmodules";
import Strings from "./strings";
import IPC from "./ipc";
import LoadingInterface from "../loading";
import Styles from "../styles/index.css";
import Editor from "./editor";
import Updater, {CoreUpdater} from "./updater";

export default new class Core {
    async startup() {
        if (this.hasStarted) return;
        this.hasStarted = true;

        Config.appPath = process.env.DISCORD_APP_PATH;
        Config.userData = process.env.DISCORD_USER_DATA;
        Config.dataPath = process.env.BETTERDISCORD_DATA_PATH;

        /**loading steps count*/
        const stepsCount = 14;

        // Load css early
        Logger.log("Startup", "Injecting BD Styles");
        DOMManager.injectStyle("bd-stylesheet", Styles.toString());
        await LoadingInterface.setInitStatus(1/stepsCount*100, "Injecting BD Styles");
        
        Logger.log("Startup", "Initializing DataStore");
        DataStore.initialize();
        await LoadingInterface.setInitStatus(2/stepsCount*100, "Initializing DataStore");
        
        Logger.log("Startup", "Initializing LocaleManager");
        LocaleManager.initialize();
		await LoadingInterface.setInitStatus(3/stepsCount*100, "Initializing LocaleManager");
				
        Logger.log("Startup", "Initializing Settings");
        Settings.initialize();
        await LoadingInterface.setInitStatus(5/stepsCount*100, "Initializing Settings");
        
        Logger.log("Startup", "Initializing DOMManager");
        DOMManager.initialize();
        await LoadingInterface.setInitStatus(6/stepsCount*100, "Initializing DOMManager");
        
        Logger.log("Startup", "Waiting for connection...");
        await this.waitForConnection();
        await LoadingInterface.setInitStatus(7/stepsCount*100, "Waiting for connection...");
        
        Logger.log("Startup", "Initializing Editor");
        await Editor.initialize();
        await LoadingInterface.setInitStatus(8/stepsCount*100, "Initializing Editor");
				
        Logger.log("Startup", "Initializing Builtins");
	    Modals.initialize();
        for (const module in Builtins) {
            Builtins[module].initialize();
        }
        await LoadingInterface.setInitStatus(9/stepsCount*100, "Initializing Builtins");
        
        Logger.log("Startup", "Loading Plugins");
        // const pluginErrors = [];
        const pluginErrors = PluginManager.initialize();
        await LoadingInterface.setInitStatus(10/stepsCount*100, "Loading Plugins");
        
        Logger.log("Startup", "Loading Themes");
        // const themeErrors = [];
        const themeErrors = ThemeManager.initialize();
        await LoadingInterface.setInitStatus(11/stepsCount*100, "Loading Themes");
        
        Logger.log("Startup", "Initializing Updater");
        Updater.initialize();
        await LoadingInterface.setInitStatus(12/stepsCount*100, "Initializing Updater");
        
        Logger.log("Startup", "Getting update information");
        CoreUpdater.checkForUpdate()
        await LoadingInterface.setInitStatus(13/stepsCount*100, "Getting update information");
        
        Logger.log("Startup", "Removing Loading Interface");
        LoadingInterface.hide();
				
        // Show loading errors
        Logger.log("Startup", "Collecting Startup Errors");
        Modals.showAddonErrors({plugins: pluginErrors, themes: themeErrors});
        
        const previousVersion = DataStore.getBDData("version");
        if (Config.version !== previousVersion) {
            Modals.showChangelogModal(Changelog);
            DataStore.setBDData("version", Config.version);
        }
    }

    waitForConnection() {
        return new Promise(done => {
            if (DiscordModules.UserStore.getCurrentUser()) return done();
            DiscordModules.Dispatcher.subscribe("CONNECTION_OPEN", done);
        });
    }
};
