'use strict'

window.tabList = {}
document.addEventListener('DOMContentLoaded', async function () {
    loadStorage().then(list => {
        tabList = list
        storageShowAll()
    }).catch((err, list) => {
        tabList = list || {}
        debug('loadStorage error:', err, 'list:', list)
    })

    B.browserAction.onClicked.addListener(onTakeAll)
})

// 添加上下文菜单
B.contextMenus.create({title: "打开收纳盒", onclick: openHome})
B.contextMenus.create({type: "separator"})
B.contextMenus.create({title: "收纳全部标签", onclick: onTakeAll})
B.contextMenus.create({title: "仅收纳此标签", onclick: onTake})

function onTakeAll() {
    getAllTabs().then(tabs => {
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
        debug('getAllTabs error:', err)
    })
}

function onTake(_, tab) {
    let keys = Object.keys(tabList)
    if (isExclude(tab.url)) return // 排除链接，不往下执行
    if (keys.length > 0) {
        keys.sort()
        keys.reverse()
        let key = keys[0]
        tabList[key].tabs && tabList[key].tabs.unshift({title: tab.title, url: tab.url})
        saveStorage(tabList)
    } else {
        addTabList(tabList, {title: tab.title, url: tab.url})
    }
    // B.tabs.remove(tab.id)
}

function isExclude(url) {
    if (url.indexOf(B.homeUrl) === 0) return true // 排除扩展首页
    if (url.indexOf('chrome://newtab/') === 0) return true // 排除新标签页
    if (url.indexOf('about:') === 0) return true // 排除空白页
    return false
}
