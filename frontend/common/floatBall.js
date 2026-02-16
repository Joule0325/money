// common/floatBall.js

let floatView = null;
let windowManager = null;
let context = null;
let lastUpdateTime = 0; // 用于移动节流

// 1. 检查并申请权限
function checkPermission() {
    const Build = plus.android.importClass("android.os.Build");
    const Settings = plus.android.importClass("android.provider.Settings");
    const Intent = plus.android.importClass("android.content.Intent");
    const Uri = plus.android.importClass("android.net.Uri");
    
    context = plus.android.runtimeMainActivity();
    
    if (Build.VERSION.SDK_INT >= 23) {
        if (!Settings.canDrawOverlays(context)) {
            uni.showModal({
                title: '需要权限',
                content: '请开启“显示在其他应用上层”权限，否则无法显示悬浮球。',
                showCancel: false,
                success: (res) => {
                    if (res.confirm) {
                        const intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.getPackageName()));
                        context.startActivity(intent);
                    }
                }
            });
            return false;
        }
    }
    return true;
}

// 2. 显示悬浮球
function show(onClickCallback) {
    if (!checkPermission()) return;
    if (floatView) return; 

    const Build = plus.android.importClass("android.os.Build");
    const TextView = plus.android.importClass("android.widget.TextView");
    const Color = plus.android.importClass("android.graphics.Color");
    const WindowManager = plus.android.importClass("android.view.WindowManager");
    // 引入 GradientDrawable 用于画圆形背景
    const GradientDrawable = plus.android.importClass("android.graphics.drawable.GradientDrawable");
    
    context = plus.android.runtimeMainActivity();
    windowManager = context.getSystemService("window");
    
    if (!windowManager) {
        windowManager = context.getWindowManager();
    }

    if (!windowManager) {
        console.error("❌ 无法获取 WindowManager");
        return;
    }
    
    // --- 🛠️ 修复全屏问题：使用带参数的构造函数 ---
    
    // 1. 准备参数
    let type = 2002;
    if (Build.VERSION.SDK_INT >= 26) {
        type = 2038; // TYPE_APPLICATION_OVERLAY
    }
    
    // Flags: Not Focusable (8) | Layout In Screen (256)
    let flags = 8 | 256;
    
    // Format: Translucent (1)
    let format = 1;
    
    // 宽高: 140 (注意：这里直接传入构造函数，防止默认全屏)
    const width = 140;
    const height = 140;

    // 2. 创建 LayoutParams (int w, int h, int type, int flags, int format)
    const params = plus.android.newObject(
        "android.view.WindowManager$LayoutParams",
        width, height, type, flags, format
    );
    
    // 3. 设置位置
    params.gravity = 51; // Left | Top
    params.x = 0;
    params.y = 500;

    // --- 创建视图 ---
    floatView = new TextView(context);
    floatView.setText("记");
    floatView.setTextSize(16);
    floatView.setTextColor(Color.WHITE);
    floatView.setGravity(17); // Gravity.CENTER
    
    // --- 🎨 美化：设置圆形背景 ---
    const drawable = new GradientDrawable();
    drawable.setShape(1); // OVAL (圆形)
    drawable.setColor(Color.parseColor("#764ba2"));
    // 给一点描边让它看清楚
    drawable.setStroke(2, Color.WHITE); 
    floatView.setBackground(drawable);
    
    // --- 触摸监听 ---
    let startX = 0, startY = 0;
    let initialX = 0, initialY = 0;
    let isClick = false;

    const touchListener = plus.android.implements("android.view.View$OnTouchListener", {
        "onTouch": function(view, event) {
            const action = event.getAction();
            switch (action) {
                case 0: // DOWN
                    isClick = true;
                    initialX = params.x;
                    initialY = params.y;
                    startX = event.getRawX();
                    startY = event.getRawY();
                    return true;
                    
                case 2: // MOVE
                    const now = Date.now();
                    // 🛠️ 修复闪退：节流，每 16ms (约60fps) 更新一次，避免调用过于频繁炸机
                    if (now - lastUpdateTime < 16) {
                        return true; 
                    }
                    lastUpdateTime = now;

                    const dx = event.getRawX() - startX;
                    const dy = event.getRawY() - startY;
                    
                    // 移动超过 10px 视为拖拽，不是点击
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) isClick = false;
                    
                    params.x = initialX + dx;
                    params.y = initialY + dy;
                    
                    try {
                        plus.android.invoke(windowManager, "updateViewLayout", floatView, params);
                    } catch (e) {
                        console.error("更新悬浮球位置失败", e);
                    }
                    return true;
                    
                case 1: // UP
                    if (isClick && onClickCallback) {
                        // 🔥 修复点击闪退：
                        // 在 onTouch 内部直接调用 hide() 销毁 View 会导致 Crash。
                        // 必须使用 setTimeout 将回调逻辑抛出到下一个事件循环执行。
                        setTimeout(() => {
                            onClickCallback();
                        }, 50);
                    }
                    return true;
            }
            return false;
        }
    });

    floatView.setOnTouchListener(touchListener);
    
    try {
        plus.android.invoke(windowManager, "addView", floatView, params);
    } catch (e) {
        console.error("❌ 添加悬浮球 View 报错:", e);
    }
}

function hide() {
    if (floatView && windowManager) {
        try {
            plus.android.invoke(windowManager, "removeView", floatView);
        } catch (e) {}
        floatView = null;
    }
}

export default { show, hide };