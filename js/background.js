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

    B.browserAction.onClicked.addListener(onClicked)
})

// 添加上下文菜单
B.contextMenus.create({title: "打开收纳盒", onclick: openHome})
B.contextMenus.create({title: "收纳全部标签", onclick: onClicked})

function onClicked() {
    getAllTabs().then(tabs => {
        let ids = []
        let arr = []
        let list = []
        tabs.forEach(tab => {
            ids.push(tab.id)
            if (tab.url.indexOf(B.homeUrl) === 0) return // 排除扩展首页
            if (tab.url.indexOf('chrome://newtab/') === 0) return // 排除新标签页
            if (tab.url.indexOf('about:') === 0) return // 排除空白页
            if (arr.includes(tab.url)) return // 排除重复链接
            arr.push(tab.url)
            list.push({title: tab.title, url: tab.url})
        })
        addTabList(list)
        openHome()
        B.tabs.remove(ids)
    }).catch(err => {
        debug('getAllTabs error:', err)
    })
}
