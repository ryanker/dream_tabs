'use strict'

window.tabList = {}
document.addEventListener('DOMContentLoaded', async function () {
    loadStorage().then(list => {
        tabList = list
        storageShowAll()
    }).catch(err => {
        debug('loadStorage error:', err)
    })

    B.browserAction.onClicked.addListener(onTakeAll)
})

// 添加上下文菜单
B.contextMenus.create({title: "打开收纳盒", onclick: openHome})
B.contextMenus.create({type: "separator"})
B.contextMenus.create({title: "收纳全部标签", onclick: onTakeAll})
B.contextMenus.create({title: "仅收纳此标签", onclick: onTake})
B.contextMenus.create({type: "separator"})
B.contextMenus.create({title: "排除这个网站", onclick: onExcludeHost, type: 'checkbox', checked: false, id: 'excludeHost'})

let excludeHostArr = []
B.tabs.onActivated.addListener(function (info) {
    getTab(info.tabId).then(r => {
        let host = getHost(r.url)
        debug('host:', host)
        B.contextMenus.update('excludeHost', {checked: excludeHostArr.includes(host)})
    }).catch(err => debug('getTab error:', err))
})

// 启动时
setTimeout(() => {
    openHome()
    getTabsQuery().then(tabs => tabs.forEach(tab => {
        // 启动时，如果有新建标签页，将其关闭
        if (tab.url.indexOf(B.homeUrl) === 0
            || tab.url.indexOf('chrome://newtab/') === 0 || tab.url.indexOf('edge://newtab/') === 0
            || tab.url.indexOf('about:newtab') === 0 || tab.url.indexOf('about:home') === 0) {
            B.tabs.remove(tab.id)
        }
    }))
}, 1000)

function onTakeAll() {
    getTabsQuery().then(tabs => {
        let ids = []
        let arr = []
        let list = []
        tabs.forEach(tab => {
            ids.push(tab.id)
            if (isExclude(tab.url)) return // 排除链接
            if (arr.includes(tab.url)) return // 排除重复链接
            arr.push(tab.url)
            list.push({title: tab.title, url: tab.url})
        })
        addTabList(tabList, list)
        openHome()
        B.tabs.remove(ids)
    }).catch(err => {
        debug('getTabsQuery error:', err)
    })
}

function onTake(_, tab) {
    if (isExclude(tab.url)) return // 排除链接，不往下执行
    let keys = Object.keys(tabList)
    if (keys.length > 0) {
        keys.sort()
        keys.reverse()
        let key = keys[0]
        tabList[key].tabs && tabList[key].tabs.unshift({title: tab.title, url: tab.url})
        saveStorage(tabList)
    } else {
        addTabList(tabList, [{title: tab.title, url: tab.url}])
    }

    // 打开主页
    getTabsQuery({
        url: B.homeUrl + '*'
    }).then(tabs => {
        if (tabs.length === 0) {
            openHome()
        } else {
            tabs.forEach((tab, i) => {
                if (i === 0) {
                    B.tabs.update(tab.id, {active: true})
                    B.tabs.reload(tab.id)
                } else {
                    B.tabs.remove(tab.id)
                }
            })
        }
    })
    // B.tabs.remove(tab.id)
}

function onExcludeHost(_, tab) {
    let host = getHost(tab.url)
    let isInclude = excludeHostArr.includes(host)
    if (isInclude) {
        let n = excludeHostArr.indexOf(host)
        if (n > -1) excludeHostArr.splice(n, 1)
    } else {
        excludeHostArr.push(host)
    }
    B.contextMenus.update('excludeHost', {checked: !isInclude})
}

function isExclude(url) {
    if (!url) return true
    if (url.indexOf(B.homeUrl) === 0) return true // 排除扩展首页
    if (url.indexOf('chrome://newtab/') === 0) return true // 排除新标签页
    if (url.indexOf('edge://newtab/') === 0) return true // 排除新标签页
    if (url.indexOf('about:') === 0) return true // 排除空白页 & Firefox
    return excludeHostArr.includes(getHost(url))
}
