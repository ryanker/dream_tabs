let bg = chrome.extension.getBackgroundPage()
let tabList = bg.tabList

let mainEl = document.querySelector('.main')
document.addEventListener('DOMContentLoaded', async function () {
    init()
})

function init() {
    let s = ''
    sortTabList(tabList).forEach(items => {
        let iconStr = ''
        if (items.topped) iconStr += '<span class="icon icon-favorite"></span>'
        if (items.locked) iconStr += '<span class="icon icon-lock"></span>'
        s += `<div class="tab_cards" data-key="${items.createDate}">
<div class="card_title">
    ${iconStr}
    <span class="item_title">${items.title}</span>
    <span class="item_num">${items.tabs.length} 个标签</span>
    <span class="dmx_button" data-action="openAll"><i class="icon icon-open"></i>打开全部</span>
    <span class="extra">
        <span class="dmx_button" data-action="lock">${items.locked ? '<i class="icon icon-unlock"></i>解锁' : '<i class="icon icon-lock"></i>锁定'}</span>
        <span class="dmx_button" data-action="topping">${items.topped ? '<i class="icon icon-favorite-line"></i>撤顶' : '<i class="icon icon-favorite"></i>置顶'}</span>
        <span class="dmx_button" data-action="rename"><i class="icon icon-edit"></i>改名</span>
        ${items.locked ? '' : '<span class="dmx_button" data-action="deleteAll"><i class="icon icon-trash"></i>删除</span>'}
    </span>
</div>`
        s += '<div class="card_items">'
        items.tabs.forEach((v, k) => {
            s += `<div class="item" data-key="${k}"><img src="chrome://favicon/${v.url}"><a href="${v.url}">${v.title}</a>${items.locked ? '' : '<span class="dmx_button item_remove" data-action="delete"><i class="icon icon-remove"></i>删除</span>'}</div>`
        })
        s += '</div></div>'
    })
    mainEl.innerHTML = s

    // 打开单条
    mainEl.querySelectorAll('.item').forEach(el => {
        el.addEventListener('click', function () {
            open(this.querySelector('a').href)

            // 如果没有上锁，就删除数据
            let p = this.parentNode.parentNode
            let d = this.parentNode
            let pkey = p.dataset.key
            let ikey = d.dataset.key
            if (!tabList[pkey].locked) {
                d.remove()
                tabList[pkey].tabs.splice(ikey, 1)
                if (tabList[pkey].tabs.length < 1) delete tabList[pkey]
                saveStorage(tabList)
                init()
            }
        })
    })
    mainEl.querySelectorAll('.item a').forEach(el => {
        el.addEventListener('click', e => e.preventDefault())
    })

    // 打开全部
    mainEl.querySelectorAll('.card_title [data-action="openAll"]').forEach(el => {
        el.addEventListener('click', function () {
            let p = this.parentNode.parentNode
            p.querySelectorAll('.item a').forEach(aEl => {
                open(aEl.href)
            })

            // 如果没有上锁，就删除数据
            if (!tabList[p.dataset.key].locked) {
                p.remove()
                delete tabList[p.dataset.key]
                saveStorage(tabList)
            }
        })
    })

    // 删除单条
    mainEl.querySelectorAll('.item [data-action="delete"]').forEach(el => {
        el.addEventListener('click', function (e) {
            e.stopPropagation()
            e.preventDefault()
            let p = this.parentNode.parentNode.parentNode
            let d = this.parentNode
            let pkey = p.dataset.key
            let ikey = d.dataset.key
            if (tabList[pkey]?.tabs) {
                d.remove()
                tabList[pkey].tabs.splice(ikey, 1)
                if (tabList[pkey].tabs.length < 1) delete tabList[pkey]
                saveStorage(tabList)
                init()
            }
        })
    })

    // 删除全部
    mainEl.querySelectorAll('.card_title [data-action="deleteAll"]').forEach(el => {
        el.addEventListener('click', function () {
            if (!confirm("您确定要删除这些标签页吗？")) return
            let p = this.parentNode.parentNode.parentNode
            p.remove()

            // 删除数据
            delete tabList[p.dataset.key]
            saveStorage(tabList)
        })
    })

    // 锁定
    mainEl.querySelectorAll('.card_title [data-action="lock"]').forEach(el => {
        el.addEventListener('click', function () {
            let p = this.parentNode.parentNode.parentNode
            let pkey = p.dataset.key
            if (tabList[pkey]) {
                tabList[pkey].locked = !tabList[pkey].locked
                saveStorage(tabList)
                init()
            }
        })
    })

    // 置顶
    mainEl.querySelectorAll('.card_title [data-action="topping"]').forEach(el => {
        el.addEventListener('click', function () {
            let p = this.parentNode.parentNode.parentNode
            let pkey = p.dataset.key
            if (tabList[pkey]) {
                let val = !tabList[pkey].topped
                tabList[pkey].topped = val
                tabList[pkey].toppedDate = val ? Date.now() : 0
                saveStorage(tabList)
                init()
            }
        })
    })

    // 改名
    mainEl.querySelectorAll('.card_title [data-action="rename"]').forEach(el => {
        el.addEventListener('click', function () {
            let tEl = this.parentNode.parentNode.querySelector('.item_title')
            tEl.setAttribute('contenteditable', true)
            tEl.focus()
        })
    })
    mainEl.querySelectorAll('.item_title').forEach(el => {
        let fun = function (el) {
            let p = el.parentNode.parentNode
            let pkey = p.dataset.key
            if (tabList[pkey]) {
                let title = el.innerText.replace(/\n/g, '') || getTitle(Number(pkey))
                tabList[pkey].title = title
                el.innerText = title
                el.setAttribute('contenteditable', false)
                saveStorage(tabList)
            }
        }
        el.addEventListener('blur', () => fun(el))
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault()
                fun(el)
            }
        })
    })
}
