<template>
  <view class="container">
    
    <!-- 顶部资产卡片 -->
    <view class="asset-card">
      <view class="card-header">
        <view class="month-selector">
          <text>{{ currentMonth }}月支出</text>
        </view>
        <view class="stats-btn" @click="onClickStats">
          <text>📊 统计</text>
        </view>
      </view>

      <view class="card-body">
        <view class="data-left">
          <view class="main-number-group">
            <text class="currency">¥</text>
            <text class="big-num">{{ totalExpense }}</text>
          </view>
          <view class="sub-data-row">
            <view class="sub-item">
              <text class="label">收入</text>
              <text class="val">{{ totalIncome }}</text>
            </view>
            <view class="divider">|</view>
            <view class="sub-item">
              <text class="label">结余</text>
              <text class="val">{{ totalBalance }}</text>
            </view>
          </view>
        </view>

        <view class="data-right">
          <view class="budget-capsule">
            <view class="budget-header">
              <text>本月预算</text>
              <text class="budget-num">{{ monthlyBudget }}</text>
            </view>
            <view class="progress-track">
              <view 
                class="progress-bar" 
                :class="{ 'warning': budgetPercent > 80, 'danger': budgetPercent >= 100 }"
                :style="{ width: budgetPercent + '%' }"
              ></view>
            </view>
            <view class="budget-footer">
              <text>剩余</text>
              <text class="remain-num">{{ budgetRemain }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 🛠️ 调试工具栏 -->
    <view class="debug-bar">
        <button class="btn-debug" @click="initFloatBall">🔘 开启悬浮球 (调试)</button>
    </view>

    <!-- 账单列表 -->
    <scroll-view scroll-y="true" class="list-container">
      <view v-if="records.length === 0" class="empty-tip">
        <text>暂无数据，点击右下角 "+" 开始记账</text>
        <view style="margin-top:10px; font-size:12px; color:#999;">
             如果数据加载不出来，请检查下方 IP 配置
        </view>
      </view>

      <view 
        v-for="(dayGroup, index) in groupedRecords" 
        :key="dayGroup.date" 
        class="daily-card"
      >
        <view class="daily-header">
          <view class="date-info">
            <text class="date-text">{{ dayGroup.date }}</text>
            <text class="weekday-text">{{ dayGroup.weekday }}</text>
          </view>
          <view class="daily-sum">
            <text v-if="dayGroup.income > 0" class="sum-income">收 {{ dayGroup.income }}</text>
            <text v-if="dayGroup.expense > 0" class="sum-expense">支 {{ dayGroup.expense }}</text>
          </view>
        </view>

        <view class="daily-items">
          <view 
            v-for="item in dayGroup.items" 
            :key="item._id" 
            class="record-item"
            @longpress="deleteRecord(item._id)"
          >
            <view class="record-left">
              <view class="icon-placeholder">{{ getIcon(item.note) }}</view>
              <view class="record-detail">
                <text class="record-note">{{ item.note || '无备注' }}</text>
                <text class="record-time">{{ item.timeStr }}</text>
              </view>
            </view>
            <view class="record-right">
              <text 
                class="record-amount"
                :class="item.type === 'income' ? 'text-income' : 'text-expense'"
              >
                {{ item.type === 'income' ? '+' : '-' }}{{ Number(item.amount).toFixed(2) }}
              </text>
            </view>
          </view>
        </view>
      </view>
      
      <view style="height: 100px;"></view>
    </scroll-view>

    <!-- 悬浮按钮 (App内的加号) -->
    <view class="fab-button" @click="openModal">
      <text class="fab-icon">+</text>
    </view>

    <!-- 记账弹窗 -->
    <view class="modal-mask" v-if="showModal" @click="closeModal"></view>
    
    <view class="modal-panel" :class="{ 'show': showModal }">
      <view class="modal-header">
        <text class="modal-title">记一笔</text>
        <text class="close-btn" @click="closeModal">×</text>
      </view>

      <view class="input-section-modal">
        <view class="type-switch">
          <view 
            class="switch-item" 
            :class="{ active: form.type === 'expense' }" 
            @click="form.type = 'expense'"
          >支出</view>
          <view 
            class="switch-item" 
            :class="{ active: form.type === 'income' }" 
            @click="form.type = 'income'"
          >收入</view>
        </view>
        
        <view class="input-group">
          <input 
            class="input-money-large" 
            type="digit" 
            v-model="form.amount" 
            placeholder="0.00" 
            focus="true"
          />
          <input 
            class="input-desc-modal" 
            type="text" 
            v-model="form.note" 
            placeholder="写点备注..." 
          />
        </view>
        
        <button 
          class="btn-submit" 
          :class="form.type"
          :disabled="loading" 
          @click="submitRecord"
        >
          {{ loading ? '提交中...' : '确认' }}
        </button>
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import floatBall from '@/common/floatBall.js';

// 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
// 【关键】请在这里修改为你电脑的真实 IP 地址
// 1. 电脑按 Win+R -> 输入 cmd -> 输入 ipconfig -> 找 IPv4 地址
// 2. 将下面的 '192.168.1.7' 替换成你查到的地址
// 3. 确保手机和电脑连的是同一个 WiFi
// 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
const API_BASE_URL = 'http://192.168.1.7:3000/api'; 

const records = ref([]);
const currentMonth = ref(new Date().getMonth() + 1);
const monthlyBudget = ref(3000);
const loading = ref(false);
const showModal = ref(false);

const form = ref({ 
  type: 'expense', 
  amount: '', 
  note: '' 
});

// 计算属性
const totalExpense = computed(() => records.value.filter(r => r.type === 'expense').reduce((acc, cur) => acc + Number(cur.amount), 0).toFixed(2));
const totalIncome = computed(() => records.value.filter(r => r.type === 'income').reduce((acc, cur) => acc + Number(cur.amount), 0).toFixed(0));
const totalBalance = computed(() => (Number(totalIncome.value) - Number(totalExpense.value)).toFixed(2));
const budgetRemain = computed(() => (monthlyBudget.value - Number(totalExpense.value)).toFixed(0));
const budgetPercent = computed(() => {
  if (monthlyBudget.value <= 0) return 0;
  let p = (Number(totalExpense.value) / monthlyBudget.value) * 100;
  return p > 100 ? 100 : p;
});
const groupedRecords = computed(() => {
  const groups = {};
  records.value.forEach(record => {
    // 兼容不同的日期格式
    const dateStr = record.dateStr || '未知日期';
    const [datePart, timePart] = dateStr.includes(' ') ? dateStr.split(' ') : [dateStr, ''];
    
    if (!groups[datePart]) {
      groups[datePart] = {
        date: datePart,
        weekday: '今天', // 简化处理
        items: [],
        income: 0,
        expense: 0
      };
    }
    const amount = Number(record.amount);
    if (record.type === 'income') groups[datePart].income += amount;
    else groups[datePart].expense += amount;
    groups[datePart].items.push({ ...record, timeStr: timePart });
  });
  // 按日期降序
  return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
});

const getIcon = (note) => note ? note.substring(0, 1) : '记';

// 交互方法
const openModal = () => { showModal.value = true; };
const closeModal = () => { showModal.value = false; };

const fetchRecords = () => {
  uni.request({
    url: `${API_BASE_URL}/records`,
    method: 'GET',
    success: (res) => {
      console.log('获取列表:', res.data);
      if (res.data.code === 200) records.value = res.data.data;
    },
    fail: (err) => {
      console.error('获取列表失败', err);
      // 列表获取失败时不弹窗打扰，但在控制台记录
    }
  });
};

const submitRecord = () => {
  if (!form.value.amount) {
    uni.showToast({ title: '请输入金额', icon: 'none' });
    return;
  }
  loading.value = true;
  console.log('🚀 准备提交:', form.value);

  const targetUrl = `${API_BASE_URL}/records`;

  uni.request({
    url: targetUrl,
    method: 'POST',
    data: {
        ...form.value,
        amount: Number(form.value.amount) // 确保转为数字发送
    },
    timeout: 5000,
    success: (res) => {
      console.log('服务器返回:', res); // 打印完整返回，方便调试
      if (res.data && res.data.code === 200) {
        uni.showToast({ title: '记账成功', icon: 'success' });
        // 重置表单
        form.value.amount = '';
        form.value.note = '';
        form.value.type = 'expense';
        fetchRecords();
        closeModal();
      } else {
        const msg = res.data && res.data.msg ? res.data.msg : '未知错误(请检查 server.js 是否重启)';
        uni.showModal({ 
            title: '服务端报错', 
            content: `状态码: ${res.statusCode}\n错误信息: ${msg}\n\n(如果是 404，说明 server.js 代码没更新或没重启)`, 
            showCancel: false 
        });
      }
    },
    fail: (err) => {
      // 🔥 增强错误提示，帮助定位 IP 问题
      uni.showModal({
        title: '网络连接失败',
        content: `无法连接到地址:\n${targetUrl}\n\n错误详情: ${err.errMsg}\n\n请检查:\n1. 电脑 IP 是否变了?\n2. server.js 运行了吗?\n3. 手机电脑同一 WiFi?`,
        showCancel: false
      });
    },
    complete: () => { loading.value = false; }
  });
};

const deleteRecord = (id) => {
  uni.showModal({
    title: '删除',
    content: '确定删除这条记录吗？',
    success: (res) => {
      if (res.confirm) {
        uni.request({
          url: `${API_BASE_URL}/records/${id}`,
          method: 'DELETE',
          success: (res) => { if (res.data.code === 200) fetchRecords(); }
        });
      }
    }
  });
};

const onClickStats = () => {
  uni.showToast({ title: '统计页面开发中...', icon: 'none' });
};

// =======================
// 悬浮球 & 自动截图逻辑
// =======================

const initFloatBall = () => {
    // 1. 检查环境
    // #ifdef H5
    uni.showToast({ title: '网页端不支持悬浮球，请在 App 基座运行', icon: 'none' });
    return;
    // #endif

    if (typeof plus === 'undefined') {
        uni.showToast({ title: '非 App 环境，无法使用悬浮球', icon: 'none' });
        return;
    }

    try {
        console.log('🔵 正在尝试启动悬浮球...');
        // 2. 启动悬浮球
        floatBall.show(() => {
            console.log('🖱️ 悬浮球被点击');
            handleAutoRecord();
        });
        uni.showToast({ title: '尝试开启悬浮球...', icon: 'none' });
    } catch (e) {
        console.error('❌ 悬浮球启动报错:', e);
        uni.showModal({
            title: '启动失败',
            content: '报错信息: ' + e.message + '\n请确认已使用“自定义基座”运行',
            showCancel: false
        });
    }
};

const handleAutoRecord = () => {
  floatBall.hide();
  setTimeout(() => {
    const bitmap = new plus.nativeObj.Bitmap('screen');
    bitmap.draw('CAPTURE_SCREEN', {}, () => {
      const fileName = '_doc/screenshot_' + Date.now() + '.jpg';
      bitmap.save(fileName, { overwrite: true, format: 'jpg', quality: 60 }, (i) => {
        uploadToAI(i.target);
        bitmap.clear();
        floatBall.show(() => handleAutoRecord());
      }, (e) => {
        console.error('保存图片失败', e);
        floatBall.show(() => handleAutoRecord());
      });
    }, (e) => {
      console.error('截图失败', e);
      uni.showModal({ title: '截图失败', content: '请检查是否授予了录屏/截图权限', showCancel: false});
      floatBall.show(() => handleAutoRecord());
    });
  }, 300); 
};

const uploadToAI = (filePath) => {
  uni.showLoading({ title: 'AI 分析中...' });
  const targetUrl = `${API_BASE_URL}/analyze`;
  
  uni.uploadFile({
    url: targetUrl, 
    filePath: filePath,
    name: 'image',
    success: (res) => {
      try {
        const data = JSON.parse(res.data);
        if (data.code === 200) {
          uni.showModal({
            title: 'AI 记账成功',
            content: `已记入: ${data.data.note} ¥${data.data.amount}`,
            showCancel: false
          });
          fetchRecords(); 
        } else {
          uni.showToast({ title: '识别失败: ' + data.msg, icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '解析错误', icon: 'none' });
      }
    },
    fail: (err) => {
      uni.showModal({
        title: '上传失败',
        content: `无法上传到: ${targetUrl}\n错误: ${err.errMsg}`,
        showCancel: false
      });
    },
    complete: () => { uni.hideLoading(); }
  });
};

onMounted(() => {
  fetchRecords();
  setTimeout(() => {
    initFloatBall();
  }, 1500);
});

onUnmounted(() => {
  floatBall.hide();
});
</script>

<style>
/* 保持原有样式 */
.container { padding: 20px 16px; background-color: #f6f7f9; min-height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; }
.asset-card { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); border-radius: 20px; padding: 20px; color: #fff; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(30, 60, 114, 0.3); flex-shrink: 0; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.month-selector { background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
.stats-btn { display: flex; align-items: center; font-size: 14px; opacity: 0.9; }
.card-body { display: flex; justify-content: space-between; align-items: flex-end; }
.data-left { flex: 1; }
.main-number-group { margin-bottom: 8px; display: flex; align-items: baseline; }
.currency { font-size: 20px; margin-right: 4px; font-weight: bold; }
.big-num { font-size: 36px; font-weight: bold; line-height: 1; }
.sub-data-row { display: flex; align-items: center; font-size: 12px; opacity: 0.8; }
.sub-item .val { margin-left: 4px; font-weight: 500; }
.divider { margin: 0 10px; opacity: 0.4; }
.data-right { width: 120px; margin-left: 10px; }
.budget-capsule { background: rgba(0,0,0,0.25); border-radius: 12px; padding: 10px; backdrop-filter: blur(5px); }
.budget-header { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 6px; color: rgba(255,255,255,0.8); }
.progress-track { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin-bottom: 6px; overflow: hidden; }
.progress-bar { height: 100%; background-color: #4facfe; border-radius: 2px; transition: width 0.3s ease; }
.progress-bar.warning { background-color: #f6d365; }
.progress-bar.danger { background-color: #ff6b6b; }
.budget-footer { display: flex; justify-content: space-between; font-size: 10px; }
.remain-num { font-weight: bold; color: #4facfe; }

.debug-bar { margin-bottom: 10px; display: flex; justify-content: center; }
.btn-debug { background: #ff9800; color: white; font-size: 12px; padding: 5px 15px; border-radius: 20px; border: none; }

.list-container { flex: 1; height: 0; }
.daily-card { background: #fff; border-radius: 16px; padding: 0 16px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); overflow: hidden; }
.daily-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 0 10px 0; border-bottom: 1px solid #f9f9f9; }
.date-info { display: flex; align-items: flex-end; }
.date-text { font-size: 16px; font-weight: bold; color: #333; margin-right: 8px; }
.weekday-text { font-size: 12px; color: #999; margin-bottom: 2px; }
.daily-sum { font-size: 12px; color: #999; }
.sum-income { margin-right: 8px; }
.record-item { display: flex; align-items: center; padding: 16px 0; border-bottom: 1px solid #f5f5f5; }
.record-item:last-child { border-bottom: none; }
.record-left { flex: 1; display: flex; align-items: center; }
.icon-placeholder { width: 36px; height: 36px; background: #f0f2f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #666; margin-right: 12px; font-weight: bold; }
.record-detail { display: flex; flex-direction: column; }
.record-note { font-size: 15px; color: #333; margin-bottom: 2px; font-weight: 500; }
.record-time { font-size: 12px; color: #bbb; }
.record-right { text-align: right; }
.record-amount { font-size: 16px; font-weight: bold; font-family: 'DIN', monospace; }
.text-expense { color: #333; }
.text-income { color: #52c41a; }
.empty-tip { text-align: center; color: #ccc; margin-top: 60px; font-size: 14px; }

/* FAB 悬浮按钮 */
.fab-button { position: fixed; right: 20px; bottom: 40px; width: 56px; height: 56px; background: #333; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 99; transition: transform 0.1s; }
.fab-button:active { transform: scale(0.95); }
.fab-icon { font-size: 30px; color: #fff; margin-top: -4px; }

/* Modal 样式 */
.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100; }
.modal-panel { position: fixed; bottom: 0; left: 0; right: 0; background: white; border-radius: 20px 20px 0 0; padding: 24px; z-index: 101; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-panel.show { transform: translateY(0); padding-bottom: 40px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.modal-title { font-size: 18px; font-weight: bold; }
.close-btn { font-size: 24px; color: #999; padding: 0 10px; }
.type-switch { display: flex; background: #f5f5f5; border-radius: 12px; padding: 4px; margin-bottom: 20px; }
.switch-item { flex: 1; text-align: center; padding: 10px 0; font-size: 14px; color: #888; border-radius: 10px; transition: all 0.2s; }
.switch-item.active { background: white; color: #333; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.input-group { margin-bottom: 24px; }
.input-money-large { font-size: 36px; height: 60px; border-bottom: 1px solid #eee; margin-bottom: 12px; font-weight: bold; color: #333; }
.input-desc-modal { font-size: 16px; padding: 10px 0; }
.btn-submit { border-radius: 30px; font-size: 16px; font-weight: 600; border: none; color: white; height: 50px; line-height: 50px; }
.btn-submit.expense { background: #333; }
.btn-submit.income { background: #52c41a; }
.btn-submit:active { opacity: 0.9; }
</style>