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

function addTabList(tabList, tabs) {
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
    return tabList
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
    storageLocalSet({tabList}).catch(err => debug(`save local error: ${err}`)) // 最大可存放 5M
    !isDebug && saveStorageSync(tabList) // 限制最多存放 75 K
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
                reject(err)
            })

            // 同步远程数据
            let options = []
            for (let i = 1; i <= 12; i++) options.push(`tabList_${i}`)
            await storageSyncGet(options).then(r => {
                let s = ''
                options.forEach(k => {
                    s += r[k] || ''
                })
                let o
                try {
                    o = JSON.parse(s) || {}
                } catch (err) {
                    debug('[storageSync JSON error]', err)
                }
                // console.log('o:', o)
                if (o) list = Object.assign(list, o)
                resolve(list)
            }).catch(err => {
                reject(err)
            })
        })()
    })
}

// chrome 限制单项大小为 8K，总量为 100K，超过无法存放。
// firefox 和 chrome 一样，见 https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/sync
function saveStorageSync(tabList) {
    let maxSize = 8 * 800 * 12 // 限制最大存放 75 K，如果超过，则不保存。
    let s = JSON.stringify(tabList)
    if (s.length > maxSize) {
        // 如果数据太大，仅保存已上锁的数据。
        let data = {}
        Object.keys(tabList).forEach(k => {
            let v = tabList[k]
            if (v && v.locked) data[k] = v
        })
        s = JSON.stringify(data)
        if (s.length > maxSize) return
    }

    // 分成 12 份数据
    let upData = {}
    let size = 8 * 800 // 浏览器限制大小和文档好像不太一致
    let start = 0
    for (let i = 1; i <= 12; i++) {
        upData[`tabList_${i}`] = s.substr(start, size)
        // console.log(upData[`tabList_${i}`].length)
        start += size
        if (start > s.length) break
    }
    // console.log(upData)
    storageSyncSet(upData).catch(err => debug(`save sync error: ${err}`))
}

function openHome() {
    open(B.homeUrl)
}

function open(url) {
    B.tabs.create({url})
}

function getTabsQuery(queryInfo) {
    return new Promise((resolve, reject) => {
        queryInfo = queryInfo || {}
        if (!isFirefox) {
            B.tabs.query(queryInfo, tabs => {
                B.error ? reject(B.error) : resolve(tabs)
            })
        } else {
            browser.tabs.query(queryInfo).then(tabs => resolve(tabs), err => reject(err))
        }
    })
}

function getTab(tabId) {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            B.tabs.get(tabId, info => B.error ? reject(B.error) : resolve(info))
        } else {
            browser.tabs.get(tabId).then(info => resolve(info), err => reject(err))
        }
    })
}

function getHost(url) {
    if (!url) return ''
    let u = {}
    try {
        u = new URL(url)
    } catch (e) {
    }
    return u.host || ''
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

function addClass(el, className) {
    className = className.trim()
    let oldClassName = el.className.trim()
    if (!oldClassName) {
        el.className = className
    } else if (` ${oldClassName} `.indexOf(` ${className} `) === -1) {
        el.className += ' ' + className
    }
}

function rmClass(el, className) {
    if (!el.className) return
    className = className.trim()
    let newClassName = el.className.trim()
    if ((` ${newClassName} `).indexOf(` ${className} `) === -1) return
    newClassName = newClassName.replace(new RegExp('(?:^|\\s)' + className + '(?:\\s|$)', 'g'), ' ').trim()
    if (newClassName) {
        el.className = newClassName
    } else {
        el.removeAttribute('class')
    }
}

function hasClass(el, className) {
    if (!el.className) return false
    return (` ${el.className.trim()} `).indexOf(` ${className.trim()} `) > -1
}
