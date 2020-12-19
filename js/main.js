let bg = chrome.extension.getBackgroundPage()
let tabList = bg.tabList
let mainEl = null
document.addEventListener('DOMContentLoaded', async function () {
    init()
    initDrag() // 拖放
    initExport() // 导出
    initImport() // 导入
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
        s += `<div class="card_items" data-locked="${items.locked}">`
        items.tabs.forEach((v, k) => {
            let deleteBut = items.locked ? '' : '<span class="dmx_button item_remove" data-action="delete"><i class="icon icon-remove"></i>删除</span>'
            s += `<div class="item" data-key="${k}"><img src="${getFavicon(v.url)}"><a href="${v.url}">${v.title}</a>${deleteBut}</div>`
        })
        s += '</div></div>'
    })
    if (mainEl) mainEl.remove()
    mainEl = document.createElement('div')
    mainEl.className = 'main'
    mainEl.insertAdjacentHTML('afterbegin', s)
    document.body.appendChild(mainEl)

    // 打开单条
    mainEl.querySelectorAll('.item').forEach(el => {
        el.addEventListener('click', function () {
            open(this.querySelector('a').href)

            // 如果没有上锁，就删除数据
            let p = this.parentNode.parentNode
            let d = this
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

    // 拖动
    mainEl.querySelectorAll('img,a').forEach(e => e.setAttribute('draggable', 'false')) // 禁止拖动
    mainEl.querySelectorAll('.card_items[data-locked="false"] .item').forEach(el => el.setAttribute('draggable', 'true'))
}

function initDrag() {
    let className = 'item'
    let dragEl, dragPkey, dragIkey
    let dropEl
    let shadowEl
    let checkEl = function (el, deep) {
        deep = deep || 3
        while (el) {
            if (el.className === className) return el
            if (deep < 1) return false
            deep--
            el = el.parentNode
        }
        return false
    }
    document.addEventListener("dragstart", function (e) {
        let el = checkEl(e.target)
        if (!el) return
        el.style.opacity = '.5' // 半透明
        addClass(el.parentNode, 'drag') // 隐藏删除按钮
        dragEl = el // 拖动元素
        dragPkey = el.parentNode.parentNode.dataset.key
        dragIkey = el.dataset.key

        // 放置阴影区域
        shadowEl = document.createElement('div')
        shadowEl.style.width = el.offsetWidth + 'px'
        shadowEl.style.height = el.offsetHeight + 'px'
        shadowEl.style.background = '#f8f9fa'
        shadowEl.style.border = '1px dashed #444'
        shadowEl.setAttribute('data-shadow', 'true')
    })

    document.addEventListener("dragend", function (e) {
        if (!dragEl) return
        dragEl.style.opacity = '' // 去掉透明
        dragEl.style.display = '' // 显示元素
        rmClass(dragEl.parentNode, 'drag') // 显示删除按钮
        dragEl = null
        dropEl = null
        shadowEl = null
        document.querySelectorAll('[data-shadow="true"]').forEach(el => el.remove())
    })

    document.addEventListener("dragenter", function (e) {
        let el = checkEl(e.target)
        if (!dragEl || !el || dragEl === el || el.parentNode.dataset.locked === 'true') return
        dropEl = el
    })

    document.addEventListener("dragover", function (e) {
        if (!dragEl || !dropEl || !shadowEl) return
        e.preventDefault() // 阻止默认动作以启用 drop
        let y = dropEl.offsetTop + (dropEl.offsetHeight / 2)
        if (e.pageY < y) {
            dropEl.insertAdjacentElement('beforebegin', shadowEl)
        } else {
            dropEl.insertAdjacentElement('afterend', shadowEl)
        }
        dragEl.style.display = 'none' // 隐藏元素
    })

    document.addEventListener("drop", function (e) {
        if (!dragEl || !dropEl || !shadowEl) return
        e.preventDefault()
        shadowEl.parentNode.replaceChild(dragEl, shadowEl) // 替换阴影区域

        // 获取数据移动到什么位置
        let prevEl = dragEl.previousSibling
        let ikey = prevEl && prevEl.className === className ? Number(prevEl.dataset.key) + 1 : 0
        let pkey = dragEl.parentNode.parentNode.dataset.key
        let val = tabList[dragPkey].tabs[dragIkey]
        if (!tabList[pkey]?.locked && val) {
            tabList[dragPkey].tabs.splice(dragIkey, 1) // 删除移动数据
            tabList[pkey].tabs.splice(ikey, 0, val) // 添加移动数据
            if (tabList[dragPkey].tabs.length < 1) delete tabList[dragPkey]
            saveStorage(tabList)
            init()
        }
    })
}

function initExport() {
    let el = document.querySelector('#export')
    el.addEventListener('click', function () {
        let blob = new Blob([JSON.stringify(tabList, null, 2)], {type: 'application/json'})
        el.href = window.URL.createObjectURL(blob)
        el.download = `梦想标签收纳盒数据备份_${getDate().replace(/\D/g, '')}.json`
    })
}

function initImport() {
    let el = document.querySelector('#import')
    el.addEventListener('click', function () {
        let inp = document.createElement('input')
        inp.type = 'file'
        inp.accept = 'application/json'
        inp.onchange = function () {
            let files = this.files
            if (files.length < 1) return
            let f = files[0]
            if (f.type !== 'application/json') return
            let reader = new FileReader()
            reader.onload = function (e) {
                let data
                try {
                    data = JSON.parse(e.target.result)
                } catch (e) {
                }
                if (!data) return
                tabList = Object.assign(tabList, data)
                console.log(tabList)
                saveStorage(tabList)
                init()
            }
            reader.readAsText(f)
        }
        inp.click()
    })
}

function getFavicon(url) {
    if (isFirefox) {
        return 'https://s2.googleusercontent.com/s2/favicons?domain=' + (url.indexOf('http') === 0 ? (new URL(url)).host : 'localhost')
    } else {
        return 'chrome://favicon/' + (url ? (new URL(url)).origin : '')
    }
}
