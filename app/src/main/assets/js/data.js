/* =========================================================
 * data.js — 运动/健身动作库 + 小清新线条示意图 + BMI
 *
 * 热量数据采用权威科学模型（非编造）：
 *   - MET（代谢当量）取自《Compendium of Physical Activities》
 *     (Ainsworth et al., 2011) 及美国《体力活动指南》；
 *   - 卡路里公式：kcal = MET × 体重(kg) × 时长(小时)
 *   - 计时动作：时长 = 坚持秒数
 *   - 计数动作：时长 = 次数 × 平均每次用时(secPerRep)
 *
 * BMI 数据遵循中国《成人体重判定》(WS/T 428-2013) 与
 *   WHO 亚洲成人标准：<18.5 偏低，18.5~24 标准，
 *   24~28 偏高，>=28 过高。
 * ========================================================= */
(function (global) {
  'use strict';

  const ICON = (inner) =>
    `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  const GROUND = `<line x1="8" y1="56" x2="56" y2="56" stroke-opacity="0.25"/>`;

  // met: 代谢当量(MET)；secPerRep: 完成一次的平均秒数(仅计数动作使用)
  const exercises = [
    {
      id: 'plank',
      name: '平板支撑',
      en: 'Plank',
      category: '核心',
      mode: 'timer',
      met: 3.5,            // 等长支撑，约 3.0~3.8 MET
      secPerRep: 0,
      muscles: ['腹横肌', '核心', '肩部'],
      desc: '俯卧撑起始姿势，前臂撑地，身体成一条直线，收紧腹部。',
      steps: ['前臂与脚尖支撑身体', '肩肘垂直，腹部收紧', '身体保持一条直线不塌腰', '坚持到力竭'],
      icon: ICON(`${GROUND}
        <circle cx="18" cy="30" r="4.5"/>
        <path d="M18 30 L48 30"/>
        <path d="M18 30 L15 50"/>
        <path d="M24 30 L21 50"/>
        <path d="M48 30 L54 30"/>
        <path d="M54 30 L54 50"/>`)
    },
    {
      id: 'wallsit',
      name: '靠墙静蹲',
      en: 'Wall Sit',
      category: '腿部',
      mode: 'timer',
      met: 3.0,            // 等长静力，约 3.0 MET
      secPerRep: 0,
      muscles: ['股四头肌', '臀大肌'],
      desc: '后背贴墙，大腿与地面平行，像坐在椅子上。',
      steps: ['背靠墙，双脚与肩同宽', '下滑至大腿平行地面', '膝盖不超过脚尖', '保持至力竭'],
      icon: ICON(`${GROUND}
        <line x1="52" y1="10" x2="52" y2="56" stroke-opacity="0.4"/>
        <circle cx="34" cy="18" r="4.5"/>
        <path d="M34 22 L34 40"/>
        <path d="M34 40 L20 40"/>
        <path d="M34 40 L48 40"/>
        <path d="M34 26 L20 30"/>
        <path d="M20 40 L18 56"/>
        <path d="M48 40 L50 56"/>`)
    },
    {
      id: 'jog',
      name: '原地慢跑',
      en: 'Jogging',
      category: '有氧',
      mode: 'timer',
      met: 7.0,            // 慢跑 general，约 7.0 MET
      secPerRep: 0,
      muscles: ['全身', '心肺'],
      desc: '原地轻松跑动，保持节奏与呼吸。',
      steps: ['身体直立微前倾', '膝盖抬高，脚尖落地', '摆臂自然', '保持匀速呼吸'],
      icon: ICON(`
        <circle cx="30" cy="14" r="4.5"/>
        <path d="M30 19 L30 34"/>
        <path d="M30 34 L26 48"/>
        <path d="M30 34 L38 46"/>
        <path d="M30 24 L20 30"/>
        <path d="M30 24 L42 20"/>
        <path d="M26 48 L22 56"/>
        <path d="M38 46 L44 56"/>`)
    },
    {
      id: 'squat',
      name: '深蹲',
      en: 'Squat',
      category: '腿部',
      mode: 'count',
      met: 5.0,            // 自重深蹲，约 5.0 MET（中高强度自重训练）
      secPerRep: 2.5,      // 下蹲+站起约 2.5 秒
      muscles: ['股四头肌', '臀大肌', '核心'],
      desc: '双脚与肩同宽，下蹲至大腿平行地面后站起。',
      steps: ['双脚与肩同宽，脚尖微外八', '屈髋屈膝下蹲', '大腿平行地面', '脚跟发力站起'],
      icon: ICON(`${GROUND}
        <circle cx="32" cy="14" r="4.5"/>
        <path d="M32 19 L32 32"/>
        <path d="M32 32 L20 44"/>
        <path d="M32 32 L44 44"/>
        <path d="M32 24 L22 22"/>
        <path d="M32 24 L42 22"/>
        <path d="M20 44 L18 56"/>
        <path d="M44 44 L46 56"/>`)
    },
    {
      id: 'pushup',
      name: '俯卧撑',
      en: 'Push-up',
      category: '上肢',
      mode: 'count',
      met: 8.0,            // 俯卧撑(高强度自重)，约 8.0 MET
      secPerRep: 2.0,      // 一次推起约 2 秒
      muscles: ['胸大肌', '肱三头肌', '核心'],
      desc: '俯身，手撑地，身体成直线，屈肘下沉后推起。',
      steps: ['双手撑地与肩同宽', '身体成一条直线', '屈肘下沉至胸部近地', '推起回到起始'],
      icon: ICON(`${GROUND}
        <circle cx="16" cy="34" r="4.5"/>
        <path d="M16 34 L46 30"/>
        <path d="M16 34 L13 54"/>
        <path d="M22 33 L19 54"/>
        <path d="M46 30 L54 30"/>
        <path d="M54 30 L54 54"/>`)
    },
    {
      id: 'situp',
      name: '仰卧起坐',
      en: 'Sit-up',
      category: '核心',
      mode: 'count',
      met: 3.8,            // 中等强度自重训练，约 3.8 MET
      secPerRep: 2.0,
      muscles: ['腹直肌', '髋屈肌'],
      desc: '仰卧屈膝，上身卷起至坐起，再缓慢回落。',
      steps: ['仰卧屈膝脚踩地', '双手抱头或交叉胸前', '腹部发力卷起上身', '缓慢回落不砸地'],
      icon: ICON(`
        <line x1="8" y1="50" x2="56" y2="50" stroke-opacity="0.25"/>
        <circle cx="40" cy="20" r="4.5"/>
        <path d="M40 25 L30 44"/>
        <path d="M40 25 L48 44"/>
        <path d="M30 44 L18 50"/>
        <path d="M48 44 L56 50"/>
        <path d="M30 30 L18 26"/>`)
    },
    {
      id: 'jack',
      name: '开合跳',
      en: 'Jumping Jack',
      category: '有氧',
      mode: 'count',
      met: 8.0,            // 开合跳(高强度)，约 8.0 MET
      secPerRep: 1.0,      // 一次开合约 1 秒
      muscles: ['全身', '心肺'],
      desc: '跳跃时双腿分开、双手举过头顶，再跳回并拢。',
      steps: ['站立双脚并拢', '跳起同时双脚分开', '双手举过头顶击掌', '跳回还原'],
      icon: ICON(`
        <circle cx="32" cy="14" r="4.5"/>
        <path d="M32 19 L32 36"/>
        <path d="M32 36 L20 50"/>
        <path d="M32 36 L44 50"/>
        <path d="M32 24 L14 14"/>
        <path d="M32 24 L50 14"/>`)
    },
    {
      id: 'lunge',
      name: '弓步蹲',
      en: 'Lunge',
      category: '腿部',
      mode: 'count',
      met: 5.0,            // 弓步蹲(中高强度)，约 5.0 MET
      secPerRep: 3.0,      // 迈步+下蹲+站起约 3 秒
      muscles: ['股四头肌', '臀大肌', '小腿'],
      desc: '一脚向前迈出下蹲，前腿大腿平行地面后站起。',
      steps: ['站立双脚并拢', '一脚向前迈一大步', '下蹲至前腿平行地面', '后腿膝盖接近地面'],
      icon: ICON(`${GROUND}
        <circle cx="34" cy="14" r="4.5"/>
        <path d="M34 19 L34 34"/>
        <path d="M34 34 L22 46"/>
        <path d="M34 34 L48 44"/>
        <path d="M34 24 L22 22"/>
        <path d="M34 24 L46 22"/>
        <path d="M22 46 L20 56"/>
        <path d="M48 44 L50 56"/>`)
    },
    {
      id: 'highknee',
      name: '高抬腿',
      en: 'High Knees',
      category: '有氧',
      mode: 'count',
      met: 8.0,            // 高抬腿跑(高强度)，约 8.0 MET
      secPerRep: 0.5,      // 每抬一次膝盖约 0.5 秒
      muscles: ['髋屈肌', '核心', '心肺'],
      desc: '原地跑动，膝盖尽量抬高至腰部。',
      steps: ['身体直立', '交替抬膝至腰高', '前脚掌落地', '加快频率'],
      icon: ICON(`
        <circle cx="30" cy="14" r="4.5"/>
        <path d="M30 19 L30 34"/>
        <path d="M30 34 L26 42"/>
        <path d="M30 34 L40 40"/>
        <path d="M30 24 L20 26"/>
        <path d="M30 24 L42 22"/>
        <path d="M26 42 L22 56"/>
        <path d="M40 40 L46 50"/>`)
    },
    {
      id: 'mountain',
      name: '登山者',
      en: 'Mountain Climber',
      category: '核心',
      mode: 'count',
      met: 8.0,            // 登山者(高强度)，约 8.0 MET
      secPerRep: 0.5,      // 每收一次膝约 0.5 秒
      muscles: ['腹直肌', '肩', '心肺'],
      desc: '平板支撑姿势，交替将膝盖快速收向胸口。',
      steps: ['平板支撑起始', '一膝收向胸口', '快速交替换腿', '保持核心收紧'],
      icon: ICON(`${GROUND}
        <circle cx="18" cy="30" r="4.5"/>
        <path d="M18 30 L46 30"/>
        <path d="M18 30 L15 52"/>
        <path d="M24 30 L22 52"/>
        <path d="M46 30 L52 38"/>
        <path d="M52 38 L52 52"/>`)
    },
    {
      id: 'burpee',
      name: '波比跳',
      en: 'Burpee',
      category: '全身',
      mode: 'count',
      met: 9.5,            // 波比跳(极高强度)，约 9.5 MET
      secPerRep: 3.0,      // 完整一次约 3 秒
      muscles: ['全身', '心肺'],
      desc: '下蹲撑地、后跳成平板、收腿跳起击掌，一气呵成。',
      steps: ['下蹲双手撑地', '后跳成平板支撑', '收腿回蹲', '向上跳起击掌'],
      icon: ICON(`
        <circle cx="32" cy="14" r="4.5"/>
        <path d="M32 19 L32 34"/>
        <path d="M32 34 L20 48"/>
        <path d="M32 34 L44 48"/>
        <path d="M32 24 L16 14"/>
        <path d="M32 24 L50 14"/>`)
    },
    {
      id: 'bridge',
      name: '臀桥',
      en: 'Glute Bridge',
      category: '臀部',
      mode: 'count',
      met: 3.8,            // 臀桥(中等强度)，约 3.8 MET
      secPerRep: 2.5,      // 抬起+顶峰+下落约 2.5 秒
      muscles: ['臀大肌', '腘绳肌', '核心'],
      desc: '仰卧屈膝，抬起臀部至肩-膝成直线。',
      steps: ['仰卧屈膝脚踩地', '臀部发力上抬', '肩髋膝成直线', '顶峰收缩后缓慢下落'],
      icon: ICON(`
        <line x1="8" y1="52" x2="56" y2="52" stroke-opacity="0.25"/>
        <circle cx="44" cy="20" r="4.5"/>
        <path d="M44 25 L30 40"/>
        <path d="M30 40 L16 52"/>
        <path d="M30 40 L48 52"/>
        <path d="M16 52 L14 52"/>
        <path d="M48 52 L50 52"/>`)
    },
    {
      id: 'crunch',
      name: '卷腹',
      en: 'Crunch',
      category: '核心',
      mode: 'count',
      met: 3.8,            // 卷腹(中等强度)，约 3.8 MET
      secPerRep: 2.0,
      muscles: ['腹直肌'],
      desc: '仰卧屈膝，仅上背离地，感受腹部收缩。',
      steps: ['仰卧屈膝', '双手轻扶头侧', '上背部卷离地面', '腹部收缩后回落'],
      icon: ICON(`
        <line x1="8" y1="52" x2="56" y2="52" stroke-opacity="0.25"/>
        <circle cx="40" cy="24" r="4.5"/>
        <path d="M40 28 L32 44"/>
        <path d="M40 28 L50 44"/>
        <path d="M32 44 L20 52"/>
        <path d="M50 44 L56 52"/>
        <path d="M32 33 L22 30"/>`)
    },
    {
      id: 'skip',
      name: '跳绳',
      en: 'Skipping',
      category: '有氧',
      mode: 'count',
      met: 11.0,           // 跳绳(中等速度)，约 11.0 MET
      secPerRep: 0.5,      // 每跳一次约 0.5 秒
      muscles: ['全身', '小腿', '心肺'],
      desc: '双手摇绳，前脚掌轻跳，保持节奏。',
      steps: ['双手握绳柄于体侧', '手腕摇绳过头顶', '前脚掌轻跳', '保持匀速'],
      icon: ICON(`
        <circle cx="32" cy="14" r="4.5"/>
        <path d="M32 19 L32 38"/>
        <path d="M32 38 L24 54"/>
        <path d="M32 38 L40 54"/>
        <path d="M32 24 L16 22"/>
        <path d="M32 24 L48 22"/>
        <path d="M14 50 Q32 60 50 50" stroke-opacity="0.6"/>`)
    },
    {
      id: 'dip',
      name: '臂屈伸',
      en: 'Dip',
      category: '上肢',
      mode: 'count',
      met: 4.0,            // 臂屈伸(中等强度)，约 4.0 MET
      secPerRep: 2.5,      // 下降+撑起约 2.5 秒
      muscles: ['肱三头肌', '胸大肌', '肩'],
      desc: '双手撑于稳固平面，屈肘下降后撑起身体。',
      steps: ['双手撑于椅/凳边缘', '双腿前伸，身体下沉', '屈肘至约90度', '肱三头肌发力撑起'],
      icon: ICON(`
        <line x1="40" y1="14" x2="58" y2="14"/>
        <circle cx="26" cy="18" r="4.5"/>
        <path d="M26 23 L30 40"/>
        <path d="M30 40 L34 56"/>
        <path d="M32 30 L46 34"/>
        <path d="M34 56 L36 56"/>`)
    },
    {
      id: 'climb',
      name: '平板交替摸肩',
      en: 'Shoulder Tap',
      category: '核心',
      mode: 'count',
      met: 5.0,            // 平板摸肩(中高强度)，约 5.0 MET
      secPerRep: 1.5,      // 抬手摸肩一次约 1.5 秒
      muscles: ['核心', '肩部', '胸'],
      desc: '平板支撑，交替抬手摸对侧肩膀，保持身体稳定。',
      steps: ['平板支撑起始', '抬右手摸左肩', '还原换左手摸右肩', '保持髋部不晃'],
      icon: ICON(`${GROUND}
        <circle cx="18" cy="30" r="4.5"/>
        <path d="M18 30 L48 30"/>
        <path d="M18 30 L15 52"/>
        <path d="M24 30 L22 52"/>
        <path d="M48 30 L54 30"/>
        <path d="M48 26 L40 24"/>
        <path d="M54 30 L54 52"/>`)
    },
    {
      id: 'dbpress',
      name: '哑铃卧推',
      en: 'Dumbbell Bench Press',
      category: '上肢',
      mode: 'count',
      met: 6.0,            // Compendium 2011：自由力量训练(自由重量，较用力) ≈6.0 MET
      secPerRep: 2.5,      // 下放 + 上推 约 2.5 秒
      muscles: ['胸大肌', '三角肌前束', '肱三头肌'],
      desc: '仰卧长凳，双手持哑铃，屈肘下放至胸前两侧再推起。',
      steps: ['仰卧于稳固长凳', '双手正握哑铃于胸前两侧', '吸气下放至肘略低于肩', '呼气推起至手臂自然伸直'],
      icon: ICON(`
        <line x1="8" y1="52" x2="56" y2="52" stroke-opacity="0.25"/>
        <circle cx="12" cy="34" r="4.5"/>
        <path d="M16 34 L48 34"/>
        <path d="M48 34 L52 46"/>
        <path d="M52 46 L52 52"/>
        <path d="M22 34 L22 16"/>
        <path d="M34 34 L34 16"/>
        <path d="M16 16 L40 16"/>
        <circle cx="16" cy="16" r="4"/>
        <circle cx="40" cy="16" r="4"/>`)
    },
    {
      id: 'twist',
      name: '俯身转体',
      en: 'Russian Twist',
      category: '核心',
      mode: 'count',
      met: 3.8,            // 旋转抗阻训练(中等强度)，约 3.8 MET
      secPerRep: 2.0,      // 一次左右转体约 2 秒
      muscles: ['腹斜肌', '核心'],
      desc: '坐姿微后倾、双脚可抬离地面，双手胸前持物左右转体。',
      steps: ['坐姿屈膝约 60 度', '上身后倾约 45 度', '双手胸前持物贴近腹部', '腰部发力左右转动躯干'],
      icon: ICON(`
        <line x1="8" y1="56" x2="56" y2="56" stroke-opacity="0.25"/>
        <circle cx="30" cy="14" r="4.5"/>
        <path d="M30 19 L24 30"/>
        <path d="M24 30 L32 40"/>
        <path d="M32 40 L40 50"/>
        <path d="M40 50 L44 56"/>
        <path d="M32 40 L26 50"/>
        <path d="M26 50 L24 56"/>
        <path d="M30 22 L42 30"/>
        <path d="M30 24 L40 28"/>
        <circle cx="42" cy="28" r="3.5"/>`)
    },
    {
      id: 'cycling',
      name: '骑行',
      en: 'Cycling',
      category: '有氧',
      mode: 'timer',
      met: 5.8,            // Compendium 2011：bicycling 10-12 mph leisure ≈6.0 MET
      secPerRep: 0,
      muscles: ['股四头肌', '心肺', '小腿'],
      desc: '骑自行车或动感单车，保持平稳踏频，热身前低阻力。',
      steps: ['调整坐垫高度使膝盖微弯', '轻阻力起步踏频 80~90', '上身前倾微屈肘', '呼吸均匀保持微出汗'],
      icon: ICON(`
        <line x1="8" y1="56" x2="56" y2="56" stroke-opacity="0.25"/>
        <circle cx="18" cy="46" r="8"/>
        <circle cx="46" cy="46" r="8"/>
        <path d="M18 46 L30 32"/>
        <path d="M30 32 L46 46"/>
        <path d="M30 32 L38 30"/>
        <path d="M46 46 L52 26"/>
        <path d="M52 26 L46 22"/>
        <circle cx="34" cy="20" r="3.5"/>
        <path d="M34 23 L30 32"/>
        <path d="M30 32 L42 46"/>
        <path d="M30 32 L24 46"/>`)
    },
    {
      id: 'walk',
      name: '健走',
      en: 'Brisk Walking',
      category: '有氧',
      mode: 'timer',
      met: 4.3,            // Compendium 2011：walking 3.5 mph brisk ≈4.3 MET
      secPerRep: 0,
      muscles: ['腿部', '心肺'],
      desc: '快步行走，步幅比散步大、速度略快，体感微喘能说话。',
      steps: ['抬头挺胸，肩胛微后收', '手臂前后自然摆动', '前脚跟着地滚动至前脚掌', '步频约每分钟 100 步'],
      icon: ICON(`
        <line x1="8" y1="56" x2="56" y2="56" stroke-opacity="0.25"/>
        <circle cx="30" cy="14" r="4.5"/>
        <path d="M30 19 L30 34"/>
        <path d="M30 34 L22 44"/>
        <path d="M22 44 L26 56"/>
        <path d="M30 34 L40 44"/>
        <path d="M40 44 L46 56"/>
        <path d="M30 24 L20 22"/>
        <path d="M30 24 L40 26"/>`)
    },
    {
      id: 'run',
      name: '跑步',
      en: 'Running',
      category: '有氧',
      mode: 'timer',
      met: 8.3,            // Compendium 2011：running 5 mph ≈8.3 MET
      secPerRep: 0,
      muscles: ['全身', '心肺', '腿部'],
      desc: '跑步机或户外跑步，保持均匀步频与呼吸。',
      steps: ['身体微微前倾', '前脚掌或中足着地', '摆臂前后自然协调', '呼吸 3 步一吸 3 步一呼'],
      icon: ICON(`
        <line x1="8" y1="56" x2="56" y2="56" stroke-opacity="0.25"/>
        <circle cx="32" cy="14" r="4.5"/>
        <path d="M32 19 L32 32"/>
        <path d="M32 32 L46 22"/>
        <path d="M46 22 L42 12"/>
        <path d="M32 32 L18 48"/>
        <path d="M18 48 L22 56"/>
        <path d="M32 24 L48 16"/>
        <path d="M32 24 L18 24"/>`)
    }
  ];

  // 分类顺序（用于首页分组）
  const categories = ['全部', '有氧', '核心', '腿部', '上肢', '臀部', '全身'];

  // 卡路里计算（权威公式）：kcal = MET × 体重(kg) × 时长(小时)
  function calcCalories(ex, value, weight) {
    const w = weight && weight > 0 ? weight : 60;
    const durSec = ex.mode === 'timer' ? value : value * (ex.secPerRep || 1);
    return ex.met * w * (durSec / 3600);
  }

  // ---- BMI（参考《成人体重判定》WS/T 428-2013 与 WHO 亚洲成人标准）----
  // BMI = 体重(kg) / 身高(m)^2
  // 中国成人分档：<18.5 偏低 / 18.5~24 标准 / 24~28 偏高 / >=28 过高
  const BMI_BANDS = [
    { key: 'low',    label: '偏低', min: 0,   max: 18.5, color: '#3FB6EF', // 蓝
      advice: 'BMI 偏低，建议增加优质蛋白（鱼、蛋、奶、豆制品）与主食摄入，保持饮食均衡；运动方面循序渐进增加力量训练（如仰卧起坐、举重等），促进骨骼肌增长。' },
    { key: 'normal', label: '标准', min: 18.5, max: 24.0, color: '#3CC9A7', // 薄荷绿
      advice: 'BMI 处于健康区间，很棒！建议保持规律运动，每周 3~5 次中等强度有氧 + 2 次力量训练，注意作息与饮食均衡。' },
    { key: 'over',   label: '偏高', min: 24.0, max: 28.0, color: '#F2B53A', // 黄
      advice: 'BMI 偏高，建议以中等强度有氧（快走、慢跑、跳绳）为主，配合核心训练；饮食上控制精制糖与油脂，多吃蔬果与优质蛋白；避免剧烈节食，循序渐进。' },
    { key: 'high',   label: '过高', min: 28.0, max: 60.0, color: '#F47A4E', // 橙
      advice: 'BMI 过高，需重视体重管理。循序渐进地从低强度有氧（快走、椭圆机）开始，每次 30 分钟左右，配合饮食控制；必要时咨询医生或营养师制定方案。' }
  ];

  function bmiBand(v) {
    if (v == null || isNaN(v)) return null;
    return BMI_BANDS.find(b => v >= b.min && v < b.max) || BMI_BANDS[BMI_BANDS.length - 1];
  }

  function calcBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm) return null;
    const m = heightCm / 100;
    const v = weightKg / (m * m);
    return Math.round(v * 10) / 10; // 保留 1 位小数
  }

  function ageFromBirthday(birthday) {
    if (!birthday) return null;
    const b = new Date(birthday);
    if (isNaN(b.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age;
  }

  // ---- 建议体重（参考权威健康标准）----
  //   健康 BMI 区间（中国《成人体重判定》WS/T 428-2013 成人）：18.5 ~ 24.0 → 对应体重区间
  //   性别差异化目标体重：以健康 BMI 目标值估算（男≈22、女≈21，国际常用健康 BMI 目标），
  //   仅作单一建议值参考；未成年人 BMI 分档应参考年龄-性别标准（WS/T 456-2014）。
  function recommendedWeight(heightCm, gender, age) {
    if (!heightCm) return null;
    const m = heightCm / 100;
    const min = Math.round(18.5 * m * m * 10) / 10;   // 健康下限
    const max = Math.round(24.0 * m * m * 10) / 10;    // 健康上限
    let target;                                        // 健康 BMI 目标（性别差异化）
    if (gender === 'male') target = 22;
    else if (gender === 'female') target = 21;
    else target = 21.5;
    const ideal = Math.round(target * m * m * 10) / 10;
    const adult = (age == null) || age >= 18;          // 是否适用成人标准
    return { min, max, ideal, adult };
  }

  global.FitData = {
    exercises, categories, calcCalories,
    BMI_BANDS, bmiBand, calcBMI, ageFromBirthday, recommendedWeight
  };
})(window);
