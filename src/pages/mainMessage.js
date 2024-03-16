import { options, updateOptions } from "../render_modules/options.js";
// 右键菜单相关操作
import { addEventqContextMenu } from "../render_modules/qContextMenu.js";
// 撤回事件监听
import { newMessageRecall } from "../render_modules/messageRecall.js";
// 消息列表监听
import { observerMessageList } from "../render_modules/observerMessageList.js";
// 监听输入框上方功能
import { observerChatArea } from "../render_modules/observerChatArea.js";
// 背景壁纸模块
import "../render_modules/wallpaper.js";
// 通用监听输入框编辑事件
import { observeChatBox } from "../render_modules/observeChatBox.js";
// 通用聊天消息列表处理模块
import { chatMessageList } from "../render_modules/chatMessageList.js";
// 阻止拖拽多选消息
import { touchMoveSelectin } from "../render_modules/touchMoveSelectin.js";
// 更新输入框上方功能列表
import { observeChatTopFunc } from "../render_modules/observeChatTopFunc.js";
// 页面插入本地表情功能
import { localEmoticons } from "../render_modules/localEmoticons.js";
// 消息后缀提示模块
import "../render_modules/messageTail.js";
// 打开频道事件
import { openGuidMainWindow } from "../render_modules/nativeCall.js";
// 防抖函数
import { debounce } from "../render_modules/debounce.js";
// 首次执行检测
import { first } from "../render_modules/first.js";
import { reminderEl } from "../render_modules/HTMLtemplate.js";
// log
import { Logs } from "../render_modules/logs.js";
const log = new Logs("主窗口");

addEventqContextMenu();
touchMoveSelectin("chat-msg-area");
chatMessageList();
newMessageRecall();

// 修复占用过高的一个临时解决办法
if (options.fixAbnormalResourceUsage) {
  openGuidMainWindow();
}

/**
 * 记录的聊天对象对应离开时的消息id
 */
let uidToMessageId = new Map();
/**
 * 代理数据
 */
let curAioData = undefined;
/**
 * 当前聊天对象的uid
 */
let curUid = undefined;

/**
 * 侧边栏数据
 */
let navStore = undefined;

lite_tools.onKeywordReminder((_, peerUid, msgId) => {
  if (!window.keywordReminder) {
    window.keywordReminder = new Map();
  }
  let value = window.keywordReminder.get(peerUid);
  if (!value) {
    value = [];
  }
  value.push(msgId);
  log("新增 关键词提醒", peerUid, msgId, value);
  window.keywordReminder.set(peerUid, value);
  injectReminder(curUid);
});

// 更新可见消息id
const updateVisibleItem = debounce(() => {
  if (options.message.currentLocation) {
    const visibleItems = document.querySelector(".ml-area.v-list-area").__VUE__[0].exposed.getVisibleItems();
    if (visibleItems.length) {
      const visibleItem = visibleItems.shift();
      // log("更新可见消息id", visibleItem);
      uidToMessageId.set(curUid, visibleItem.id);
    }
  }
}, 100);

// 监听聊天对象变动
Object.defineProperty(app.__vue_app__.config.globalProperties.$store.state.common_Aio, "curAioData", {
  enumerable: true,
  configurable: true,
  get() {
    return curAioData;
  },
  set(newVal) {
    log("uin更新", newVal);
    curAioData = newVal;
    curUid = newVal?.header?.uid;
    if (options.message.currentLocation && newVal?.header?.uid) {
      const messageId = uidToMessageId.get(newVal.header.uid);
      injectReminder(curUid);
      if (messageId && messageId != "0") {
        // log("有记录历史位置，执行跳转", messageId);
        document.querySelector(".ml-area.v-list-area").__VUE__[0].exposed.scrollToItem(messageId);
      } else {
        // log("没有记录历史位置，不执行跳转");
        updateVisibleItem();
      }
    }
  },
});

function injectReminder(uid) {
  if (!window.keywordReminder) {
    window.keywordReminder = new Map();
  }
  const value = window.keywordReminder.get(uid);
  log("获取当前页面的关键词提醒", uid, value);
  if (value?.length) {
    document.querySelector(".lite-tools-keywordReminder")?.remove();
    const HTMLtemplate = reminderEl.replace("{{nums}}", value.length);
    document.querySelector(".chat-msg-area__tip--top").insertAdjacentHTML("beforeend", HTMLtemplate);
    const keywordReminderEl = document.querySelector(".lite-tools-keywordReminder");
    keywordReminderEl.innerText = `${value.length} 条消息有提醒词`;
    keywordReminderEl.addEventListener("click", () => {
      const msgId = value.pop();
      document.querySelector(".ml-area.v-list-area").__VUE__[0].exposed.scrollToItem(msgId);
      window.keywordReminder.set(uid, value);
      if (value.length) {
        keywordReminderEl.innerText = `${value.length} 条消息有提醒词`;
      } else {
        keywordReminderEl.remove();
        hookUpdate();
      }
    });
  } else {
    document.querySelector(".lite-tools-keywordReminder")?.remove();
    hookUpdate();
  }
}

chatMessage();
const observe = new MutationObserver(chatMessage);
observe.observe(document.body, {
  childList: true,
  subtree: true,
});
updateOptions(chatMessage);

/**
 * 监听鼠标侧键返回事件
 */

// 返回没有选中聊天时的状态
document.addEventListener("mouseup", (event) => {
  if (event.button === 3 && options.message.goBackMainList) {
    document.querySelector(".two-col-layout__aside .recent-contact .list-toggler").__VUE__[1].proxy.goBackMainList();
  }
});

/**
 * 初始化聊天消息功能，包括滚动事件、贴纸条、侧边栏项目、GIF热点地图、徽章、头像显示、消息气泡调整和移除VIP红名。
 */
function chatMessage() {
  // 监听消息列表滚动
  if (document.querySelector(".ml-area .q-scroll-view") && first("scrollEvent")) {
    const el = document.querySelector(".ml-area .q-scroll-view");
    el.addEventListener("scroll", updateVisibleItem);
  }
  updateVisibleItem();

  // 精简侧边栏
  navStore = document.querySelector(".nav.sidebar__nav")?.__VUE__?.[0]?.proxy?.navStore;
  navStore?.finalTabConfig?.forEach((tabIcon) => {
    const find = options.sidebar.top.find((el) => el?.id == tabIcon?.id);
    if (find && find.id !== undefined) {
      if (find.disabled) {
        tabIcon.status = 2;
      } else {
        tabIcon.status = 1;
      }
    }
  });

  // 只执行一次
  if (navStore && navStore?.finalTabConfig?.length && first("updateSiderbarNavFuncList")) {
    updateSiderbarNavFuncList();
  }

  // 特殊的三个图标
  const arr = ["消息", "联系人", "更多"];
  for (let i = 0; i < arr.length; i++) {
    const areaLabel = arr[i];
    const findLabel = options.sidebar.top.find((el) => el.name === areaLabel);
    if (findLabel) {
      document
        .querySelector(`.sidebar__upper .nav.sidebar__nav .nav-item[aria-label="${areaLabel}"]`)
        ?.classList?.toggle("LT-disabled", findLabel.disabled);
    }
  }

  // 初始化推荐表情
  document.querySelector(".sticker-bar")?.classList?.toggle("LT-disabled", options.message.disabledSticker);

  // 初始化顶部侧边栏
  document.querySelectorAll(".nav.sidebar__nav .nav-item").forEach((el, index) => {
    const find = options.sidebar.top.find((opt) => opt.index == index);
    if (find) {
      el.classList.toggle("LT-disabled", find.disabled);
    }
  });

  // 初始化底部侧边栏
  document.querySelectorAll(".func-menu.sidebar__menu .func-menu__item").forEach((el, index) => {
    const find = options.sidebar.bottom.find((opt) => opt.index == index);
    if (find) {
      el.classList.toggle("LT-disabled", find.disabled);
    }
  });

  // 消息列表气泡数字调整
  document.querySelectorAll(".list-item .list-item__container .list-item__summary .summary-bubble .vue-component").forEach((el) => {
    el.__VUE__[0].props.countLimit = options.message.removeBubbleLimit ? Number.MAX_SAFE_INTEGER : 99;
  });

  // 移除vip红名
  document.body.classList.toggle("remove-vip-name", options.message.removeVipName);

  // 禁用GIF热图
  document.body.classList.toggle("disabled-sticker-hot-gif", options.message.disabledHotGIF);

  // 禁用小红点
  document.body.classList.toggle("disabled-badge", options.message.disabledBadge);

  // 消息列表只显示头像
  document.querySelector(".two-col-layout__aside").classList.toggle("only-avatar", options.message.onlyAvatar);

  localEmoticons();
  observeChatTopFunc();
  observerChatArea();
  observeChatBox();
  hookUpdate();
  observerMessageList(".ml-list.list", ".ml-list.list .ml-item");
}

function updateSiderbarNavFuncList() {
  // 获取侧边栏顶部的功能入口
  let top = navStore.finalTabConfig.map((tabIcon) => ({
    name: tabIcon.label,
    id: tabIcon.id,
    disabled: tabIcon.status === 1 ? false : true,
  }));
  // 插入特殊的三个图标数据
  top.unshift(
    { name: "消息", disabled: options?.sidebar?.top?.find((el) => el.name === "消息")?.disabled ?? false, id: -1 },
    { name: "联系人", disabled: options?.sidebar?.top?.find((el) => el.name === "联系人")?.disabled ?? false, id: -1 },
    { name: "更多", disabled: options?.sidebar?.top?.find((el) => el.name === "更多")?.disabled ?? false, id: -1 },
  );
  // 获取侧边栏底部的功能入口
  let bottom = Array.from(document.querySelectorAll(".func-menu.sidebar__menu .func-menu__item")).map((el, index) => {
    if (el.querySelector(".icon-item").getAttribute("aria-label")) {
      const item = {
        name: el.querySelector(".icon-item").getAttribute("aria-label"),
        index,
        disabled: el.classList.contains("LT-disabled"),
      };
      if (item.name === "更多") {
        item.name = "更多 （此选项内包含设置页面入口，不要关闭，除非你知道自己在做什么）";
      }
      return item;
    } else {
      return {
        name: "未知功能",
        index,
        disabled: el.classList.contains("LT-disabled"),
      };
    }
  });
  if (
    options.sidebar.top
      .map((el) => el.name)
      .sort()
      .join() !==
      top
        .map((el) => el.name)
        .sort()
        .join() ||
    options.sidebar.bottom
      .map((el) => el.name)
      .sort()
      .join() !==
      bottom
        .map((el) => el.name)
        .sort()
        .join()
  ) {
    log("更新侧边栏数据", top, bottom);
    lite_tools.sendSidebar({
      top,
      bottom,
    });
  }
}

function hookUpdate() {
  document.querySelectorAll(".two-col-layout__aside .viewport-list__inner .list-item").forEach((el) => {
    if (!el?.__VUE__?.[1]?.update?.isHooked) {
      const vue = el.__VUE__[1];
      const peerUid = vue.ctx.peerUid;
      const tempUpdate = vue.update;
      if (!window.keywordReminder) {
        window.keywordReminder = new Map();
      }
      vue.update = () => {
        const value = window.keywordReminder.get(peerUid);
        // // log("消息更新", value);
        if (value?.length) {
          if (vue?.ctx?.abstracts[0]?.content !== "关键词提醒") {
            vue.ctx.abstracts.unshift({
              content: "关键词提醒",
              contentStyle: "warning",
              type: "msgBox",
            });
          }
        } else {
          if (vue?.ctx?.abstracts[0]?.content === "关键词提醒") {
            vue.ctx.abstracts.shift();
          }
        }
        tempUpdate();
      };
      vue.update.isHooked = true;
    } else {
      el?.__VUE__?.[1]?.update();
    }
  });
}
