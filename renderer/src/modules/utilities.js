import Logger from "@common/logger";
import DiscordModules from "./discordmodules";
import WebpackModules from "./webpackmodules";
import Patcher from "./patcher";

const native = WebpackModules.getModule(m => m.minimize && m.architecture);

export default class Utilities {
    /**
     * Generates an automatically memoizing version of an object.
     * @author Zerebos
     * @type {<T extends Object>(object: T) => T}
     */
    static memoizeObject(object) {
        const proxy = new Proxy(object, {
            get: function(obj, mod) {
                if (!obj.hasOwnProperty(mod)) return undefined;
                if (Object.getOwnPropertyDescriptor(obj, mod).get) {
                    const value = obj[mod];
                    delete obj[mod];
                    obj[mod] = value;
                }
                return obj[mod];
            },
            set: function(obj, mod, value) {
                if (obj.hasOwnProperty(mod)) return Logger.error("MemoizedObject", "Trying to overwrite existing property");
                obj[mod] = value;
                return obj[mod];
            }
        });

        Object.defineProperty(proxy, "hasOwnProperty", {value: function(prop) {
            return this[prop] !== undefined;
        }});

        return proxy;
    }

    /**
     * Deep extends an object with a set of other objects. Objects later in the list
     * of `extenders` have priority, that is to say if one sets a key to be a primitive,
     * it will be overwritten with the next one with the same key. If it is an object,
     * and the keys match, the object is extended. This happens recursively.
     * @param {object} extendee - Object to be extended
     * @param {...object} extenders - Objects to extend with
     * @returns {object} - A reference to `extendee`
     */
    static extend(extendee, ...extenders) {
        for (let i = 0; i < extenders.length; i++) {
            for (const key in extenders[i]) {
                if (extenders[i].hasOwnProperty(key)) {
                    if (typeof extendee[key] === "object" && typeof extenders[i][key] === "object") {
                        this.extend(extendee[key], extenders[i][key]);
                    }
                    else if (typeof extenders[i][key] === "object") {
                        extendee[key] = {};
                        this.extend(extendee[key], extenders[i][key]);
                    }
                    else {
                        extendee[key] = extenders[i][key];
                    }
                }
            }
        }
        return extendee;
    }

    /**
     * Deep extends an object with a set of other objects. Objects later in the list
     * of `extenders` have priority, that is to say if one sets a key to be a primitive,
     * it will be overwritten with the next one with the same key. If it is an object,
     * and the keys match, the object is extended. This happens recursively.
     * @param {object} extendee - Object to be extended
     * @param {...object} extenders - Objects to extend with
     * @returns {object} - A reference to `extendee`
     */
    static extendTruthy(extendee, ...extenders) {
        for (let i = 0; i < extenders.length; i++) {
            for (const key in extenders[i]) {
                if (extenders[i].hasOwnProperty(key)) {
                    if (typeof extendee[key] === "object" && typeof extenders[i][key] === "object") {
                        this.extendTruthy(extendee[key], extenders[i][key]);
                    }
                    else if (typeof extenders[i][key] === "object") {
                        extendee[key] = {};
                        this.extendTruthy(extendee[key], extenders[i][key]);
                    }
                    else if (extenders[i][key]) {
                        extendee[key] = extenders[i][key];
                    }
                }
            }
        }
        return extendee;
    }

    /**
     * Format strings with placeholders (`{{placeholder}}`) into full strings.
     * Quick example: `PluginUtilities.formatString("Hello, {{user}}", {user: "Zerebos"})`
     * would return "Hello, Zerebos".
     * @param {string} string - string to format
     * @param {object} values - object literal of placeholders to replacements
     * @returns {string} the properly formatted string
     */
    static formatString(string, values) {
        for (const val in values) {
            let replacement = values[val];
            if (Array.isArray(replacement)) replacement = JSON.stringify(replacement);
            if (typeof(replacement) === "object" && replacement !== null) replacement = replacement.toString();
            string = string.replace(new RegExp(`{{${val}}}`, "g"), replacement);
        }
        return string;
    }

    /**
     * Finds a value, subobject, or array from a tree that matches a specific filter. This is a DFS.
     * @param {object} tree Tree that should be walked
     * @param {callable} searchFilter Filter to check against each object and subobject
     * @param {object} options Additional options to customize the search
     * @param {Array<string>|null} [options.walkable=null] Array of strings to use as keys that are allowed to be walked on. Null value indicates all keys are walkable
     * @param {Array<string>} [options.ignore=[]] Array of strings to use as keys to exclude from the search, most helpful when `walkable = null`.
     */
    static findInTree(tree, searchFilter, {walkable = null, ignore = []} = {}) {
        if (typeof searchFilter === "string") {
            if (tree.hasOwnProperty(searchFilter)) return tree[searchFilter];
        }
        else if (searchFilter(tree)) {
            return tree;
        }

        if (typeof tree !== "object" || tree == null) return undefined;

        let tempReturn;
        if (tree instanceof Array) {
            for (const value of tree) {
                tempReturn = this.findInTree(value, searchFilter, {walkable, ignore});
                if (typeof tempReturn != "undefined") return tempReturn;
            }
        }
        else {
            const toWalk = walkable == null ? Object.keys(tree) : walkable;
            for (const key of toWalk) {
                if (typeof(tree[key]) == "undefined" || ignore.includes(key)) continue;
                tempReturn = this.findInTree(tree[key], searchFilter, {walkable, ignore});
                if (typeof tempReturn != "undefined") return tempReturn;
            }
        }
        return tempReturn;
    }

    /**
     * Returns a function, that, as long as it continues to be invoked, will not
     * be triggered. The function will be called after it stops being called for
     * N milliseconds.
     * 
     * Adapted from the version by David Walsh (https://davidwalsh.name/javascript-debounce-function)
     * 
     * @param {function} executor 
     * @param {number} delay 
     */
     static debounce(executor, delay) {
        let timeout;
        return function(...args) {
            const callback = () => {
                timeout = null;
                Reflect.apply(executor, null, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(callback, delay);
        };
    }

    /**
     * Takes a string of html and escapes it using the brower's own escaping mechanism.
     * @param {String} html - html to be escaped
     */
    static escapeHTML(html) {
        const textNode = document.createTextNode("");
        const spanElement = document.createElement("span");
        spanElement.append(textNode);
        textNode.nodeValue = html;
        return spanElement.innerHTML;
    }

    /**
     * Gets a nested value (if it exists) safely. Path should be something like `prop.prop2.prop3`.
     * Numbers can be used for arrays as well like `prop.prop2.array.0.id`.
     * @param {Object} obj - object to get nested value of
     * @param {string} path - representation of the key path to obtain
     */
    static getNestedValue(obj, path) {
        return path.split(".").reduce(function(ob, prop) {
            return ob && ob[prop];
        }, obj);
    }

    /**
     * Shows the guild join modal, to join invites
     * TODO: move this to the modals module
     * @param {string} code 
     */
    static async showGuildJoinModal(code) {
        const tester = /\.gg\/(.*)$/;
        if (tester.test(code)) code = code.match(tester)[1];
        
        const {invite} = await DiscordModules.InviteActions.resolveInvite(code);
        
        if (!invite) {
            Logger.debug("Utilities", "Failed to resolve invite:", code);
            return;
        }
        
        const minimize = Patcher.instead("BetterDiscord~showGuildJoinModal", native, "minimize", () => {});
        const focus = Patcher.instead("BetterDiscord~showGuildJoinModal", native, "focus", () => {});
        
        try {
            await DiscordModules.Dispatcher.dispatch({
                type: "INVITE_MODAL_OPEN",
                invite,
                code,
                context: "APP"
            });
        }
        finally {
            minimize();
            focus();
        }
    }
}