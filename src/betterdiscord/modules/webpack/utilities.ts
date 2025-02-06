import {Filters} from ".";
import { bySource } from "./filter";
import { getModule } from "./get-module";
import { webpackRequire } from "./require";
import { getDefaultKey, shouldSkipModule, wrapFilter } from "./shared";

export function *getWithKey(filter: Webpack.ExportedOnlyFilter, {target = null, ...rest}: Webpack.WithKeyOptions = {}) {
    yield target ??= getModule(exports =>
        Object.values(exports).some(filter),
        rest
    );
    
    yield target && Object.keys(target).find(k => filter(target[k]));
}

export function getMangled<T extends object>(
    filter: Webpack.Filter | string | RegExp, 
    mappers: Record<keyof T, Webpack.ExportedOnlyFilter>, 
    options: Webpack.Options = {}
): T {
    const { raw = false, ...rest } = options;

    const mapped = {} as T;

    if (typeof filter === "string" || filter instanceof RegExp) {
        filter = bySource(filter);
    }

    let module = getModule<any>(filter, { raw, ...rest });
    if (!module) return mapped;
    if (raw) module = module.exports;

    for (const searchKey in module) {
        if (!Object.prototype.hasOwnProperty.call(module, searchKey)) continue;

        for (const key in mappers) {
            if (!Object.prototype.hasOwnProperty.call(mappers, key)) continue;
            if (Object.prototype.hasOwnProperty.call(mapped, key)) continue;

            if (mappers[key](module[searchKey])) {
                Object.defineProperty(mapped, key, {
                    get() {
                        return module[searchKey];
                    },
                    set(value) {
                        module[searchKey] = value;
                    },
                    enumerable: true,
                    configurable: false
                });
            }
        }
    }

    // Set everything that was not found to undefined
    for (const key in mappers) {
        if (!Object.prototype.hasOwnProperty.call(mapped, key)) {
            Object.defineProperty(module, key, {
                value: undefined,
                enumerable: true,
                configurable: false
            });
        }
    }

    // Debug info and to not deal with types define it
    Object.defineProperty(mapped, Symbol("betterdiscord.getMangled"), { value: module });

    return mapped;
}

export function getBulk<T extends any[]>(...queries: Webpack.BulkQueries[]): T {
    const returnedModules = Array(queries.length) as T;

    queries = queries.map((query) => ({
        ...query,
        filter: wrapFilter(query.filter)
    }));

    for (const key in webpackRequire.c) {
        if (Object.prototype.hasOwnProperty.call(webpackRequire.c, key)) {
            const module = webpackRequire.c[key];

            if (shouldSkipModule(module.exports)) continue;

            queries: for (let index = 0; index < queries.length; index++) {
                const {filter, all = false, defaultExport = true, searchExports = false, searchDefault = true, raw = false} = queries[index];

                if (!all && index in returnedModules) {
                    continue;
                }

                if (filter(module.exports, module, module.id)) {
                    if (!all) {
                        returnedModules[index] = raw ? module : module.exports;
                        continue;
                    }

                    returnedModules[index] ??= [];
                    returnedModules[index].push(raw ? module : module.exports);
                }
    
                let defaultKey: string | undefined;
                const keys: string[] = [];
                if (searchExports) keys.push(...Object.keys(module.exports));
                else if (searchDefault && (defaultKey = getDefaultKey(module))) keys.push(defaultKey);
    
                for (const key of keys) {
                    const exported = module.exports[key];
    
                    if (shouldSkipModule(exported)) continue;
    
                    if (filter(exported, module, module.id)) {
                        let value = raw ? module : exported;

                        if (!defaultExport && defaultKey === key) {
                            value = raw ? module : module.exports;
                        }
    
                        if (!all) {
                            returnedModules[index] = value;
                            continue queries;
                        }
    
                        returnedModules[index] ??= [];
                        returnedModules[index].push(value);
                    }
                }
            }
        }
    }

    return returnedModules;
}

let Flux: any;
export function getStore(name: string) {
    if (!Flux) Flux = getModule(m => m.Store?.getAll);
    if (!Flux) return getModule(Filters.byStoreName(name));    

    return Flux.Store.getAll().find((store: any) => store.getName() === name);
}

export const Stores = new Proxy({} as Record<string, any>, {
    ownKeys() {
        if (!Flux) Flux = getModule(m => m.Store?.getAll);
        if (!Flux) return [];
        return [...new Set(Flux.Store.getAll().map((store: any) => store.getName()))] as string[];
    },
    getOwnPropertyDescriptor() {
        return {
            enumerable: true,
            configurable: true, // Not actually
        };
    },
    get(target, key: string) {
        return target[key] ??= getStore(key);
    },
    set() {
        throw new Error("[WebpackModules~Stores] Setting stores is not allowed.");
    }
});