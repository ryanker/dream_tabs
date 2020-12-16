'use strict'

window.isDebug = false
window.isFirefox = navigator.userAgent.includes("Firefox")
window.B = {
    getBackgroundPage: chrome.extension.getBackgroundPage,
    id: chrome.runtime.id,
    root: chrome.runtime.getURL(''),
    homeUrl: chrome.runtime.getURL('dream_tabs.html'),
    error: chrome.runtime.lastError,
    browserAction: chrome.browserAction,
    storage: chrome.storage,
    contextMenus: chrome.contextMenus,
    tabs: chrome.tabs,
}

String.prototype.format = function () {
    let args = arguments
    return this.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined' ? args[number] : match
    })
}

function addTabList(tabs) {
    if (tabs.length > 0) {
        let t = Date.now()
        tabList[t] = {
            title: getTitle(),
            locked: false,
            topped: false,
            toppedDate: 0,
            tabs,
            createDate: t,
        }
        saveStorage(tabList)
    }
}

function sortTabList(tabList) {
    let arr = []
    Object.keys(tabList).forEach(v => arr.push(tabList[v]))
    arr = arr.sort((a, b) => b.createDate - a.createDate) // 创建时间倒序
    arr = arr.sort((a, b) => b.toppedDate - a.toppedDate) // 置顶时间倒序
    return arr
}

function getTitle(value) {
    return `收纳于 ${getDate(value)} ${getWeek(value)}`
}

function getDate(value) {
    let d = value ? new Date(value) : new Date()
    d.setMinutes(-d.getTimezoneOffset() + d.getMinutes(), d.getSeconds(), 0)
    let s = d.toJSON()
    s = s.replace('T', ' ')
    s = s.replace('.000Z', '')
    return s
}

function getWeek(value) {
    let d = value ? new Date(value) : new Date()
    let weekArr = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return weekArr[d.getDay()]
}

function saveStorage(tabList) {
    localStorage.setItem('tabList', JSON.stringify(tabList))
    storageLocalSet({tabList}).catch(err => debug(`save local error: ${err}`))
    !isDebug && storageSyncSet({tabList}).catch(err => debug(`save sync error: ${err}`))
}

function loadStorage() {
    return new Promise((resolve, reject) => {
        (async () => {
            let s = localStorage.getItem('tabList')
            let list = {}
            try {
                list = JSON.parse(s) || {}
            } catch (err) {
                debug('[localStorage error]', err)
            }
            await storageLocalGet(['tabList']).then(r => {
                list = Object.assign(list, r.tabList)
            }).catch(err => {
                reject(err, list)
            })
            await storageSyncGet(['tabList']).then(r => {
                list = Object.assign(list, r.tabList)
                resolve(list)
            }).catch(err => {
                reject(err, list)
            })
        })()
    })
}

function openHome() {
    open(B.homeUrl)
}

function open(url) {
    B.tabs.create({url})
}

function getAllTabs() {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            B.tabs.query({}, tabs => {
                B.error ? reject(B.error) : resolve(tabs)
            })
        } else {
            browser.tabs.query({}).then(tabs => {
                resolve(tabs)
            }).catch(err => reject(err))
        }
    })
}

function storageLocalGet(options) {
    return storage('local', 'get', options)
}

function storageLocalSet(options) {
    return storage('local', 'set', options)
}

function storageSyncGet(options) {
    return storage('sync', 'get', options)
}

function storageSyncSet(options) {
    return storage('sync', 'set', options)
}

function storageShowAll() {
    if (!isDebug) return
    !isFirefox && storageSyncGet(null).then(function (r) {
        debug(`all sync storage:`, r)
    })
    storageLocalGet(null).then(function (r) {
        debug(`all local storage:`, r)
    })
}

function storage(type, method, options) {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            let callback = function (r) {
                let err = B.error
                err ? reject(err) : resolve(r)
            }
            let api = type === 'sync' ? B.storage.sync : B.storage.local
            if (method === 'get') {
                api.get(options, callback)
            } else if (method === 'set') {
                api.set(options, callback)
            }
        } else {
            let api = isDebug ? browser.storage.local : type === 'sync' ? browser.storage.sync : browser.storage.local
            if (method === 'get') {
                api.get(options).then(r => resolve(r), err => reject(err))
            } else if (method === 'set') {
                api.set(options).then(r => resolve(r), err => reject(err))
            }
        }
    })
}

function debug(...data) {
    isDebug && console.log('[DMX DEBUG]', ...data)
}
