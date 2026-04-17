(function () {
  if (window.__opcFriendLinksMounted) return;
  window.__opcFriendLinksMounted = true;

  const links = [
    ["小报童导航", "https://www.xiaobot.net.cn", "收录优质小报童专栏，助你快速找到所需专栏内容。"],
    ["VibeCoding导航", "https://vibcoding.cn", "VibeCoding（氛围编程）资源导航站，收录 VibeCoding 相关资源工具。"],
    ["省省家会员卡券", "https://buy.lkami.cn", "收录全网优惠会员卡券，折扣低价，每日更新。"],
    ["搜软正版软件", "https://www.soruan.cn", "收录正版软件优惠渠道。"],
    ["VPS导航", "https://www.vpswa.com", "收集国内外最新最全的 VPS、云服务器、网络工具网址导航。"],
    ["搜副业", "https://www.sofuye.com", "副业项目资源搜索引擎，永久免费。"],
    ["AI导航", "https://www.ainav.link", "收录国内外数百个 AI 工具。"],
    ["Claw龙虾导航", "https://www.clawnav.cn", "OpenClaw 人工智能生态平台，提供排行榜、教程和技能插件内容。"],
    ["CPS导航", "https://www.cpsnav.com", "收录全网支持 CPS 分销返佣资源平台。"],
    ["魔武网络科技工作室", "http://www.shenzhendeyang.com", "魔武网络科技工作室。"],
  ];

  function createFooterIfMissing() {
    let footer = document.querySelector("footer");
    if (footer) return footer;
    footer = document.createElement("footer");
    footer.style.textAlign = "center";
    footer.style.padding = "30px 20px";
    footer.style.color = "var(--dim, #64748B)";
    footer.style.fontSize = ".78em";
    footer.style.borderTop = "1px solid var(--border, #E2E8F0)";
    footer.innerHTML =
      '<p>opcgate.com · 每条政策附官方来源 · 拒绝 AI 编造</p><p style="margin-top:4px"><a href="index.html">首页</a> · <a href="compare.html">对比工具</a></p>';
    document.body.appendChild(footer);
    return footer;
  }

  function mount() {
    const footer = createFooterIfMissing();
    if (footer.querySelector(".friend-links-auto")) return;

    const wrap = document.createElement("div");
    wrap.className = "friend-links-auto";
    wrap.style.marginTop = "14px";
    wrap.style.paddingTop = "14px";
    wrap.style.borderTop = "1px solid rgba(148,163,184,.18)";

    const title = document.createElement("p");
    title.textContent = "友情链接（Logo 位预留，明天可直接替换）";
    title.style.fontSize = ".75em";
    title.style.color = "var(--dim, #64748B)";
    title.style.marginBottom = "10px";
    wrap.appendChild(title);

    const grid = document.createElement("div");
    grid.style.display = "flex";
    grid.style.justifyContent = "center";
    grid.style.gap = "8px";
    grid.style.flexWrap = "wrap";

    links.forEach(([name, href, desc]) => {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = desc;
      a.style.display = "inline-flex";
      a.style.alignItems = "center";
      a.style.gap = "8px";
      a.style.padding = "8px 12px";
      a.style.background = "rgba(148,163,184,.08)";
      a.style.border = "1px solid rgba(148,163,184,.16)";
      a.style.borderRadius = "999px";
      a.style.color = "inherit";
      a.style.fontSize = ".78em";

      const logo = document.createElement("span");
      logo.textContent = "Logo";
      logo.style.width = "18px";
      logo.style.height = "18px";
      logo.style.border = "1px dashed rgba(148,163,184,.45)";
      logo.style.borderRadius = "5px";
      logo.style.display = "inline-flex";
      logo.style.alignItems = "center";
      logo.style.justifyContent = "center";
      logo.style.fontSize = ".52em";
      logo.style.color = "var(--dim, #64748B)";

      const text = document.createElement("span");
      text.textContent = name;

      a.appendChild(logo);
      a.appendChild(text);
      grid.appendChild(a);
    });

    wrap.appendChild(grid);
    footer.appendChild(wrap);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
