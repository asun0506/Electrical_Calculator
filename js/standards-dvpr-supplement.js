/** DVP&R 相关材料、工艺、密封和环境标准补充。 */
(function (global) {
  'use strict';
  const lib = global.ELECTRICAL_STANDARD_LIBRARY;
  if (!lib) return;
  const iso = (q) => `https://www.iso.org/search.html?q=${encodeURIComponent(q)}`;
  const iec = (q) => `https://webstore.iec.ch/en/search?query=${encodeURIComponent(q)}`;
  const gb = (q) => `https://openstd.samr.gov.cn/bzgk/std/std_list?p.p1=0&p.p2=${encodeURIComponent(q)}`;
  const records = [
    {no:'ISO 9227:2022',system:'ISO',topic:'环境可靠性',status:'现行',level:'材料/零件',title:'人造气氛腐蚀试验—盐雾试验',summary:'规定中性盐雾、乙酸盐雾和铜加速乙酸盐雾的设备、试剂与操作方法；不直接规定某一产品的暴露时长和合格限值。',focus:['盐雾','腐蚀','表面处理'],source:'https://www.iso.org/standard/81744.html'},
    {no:'ISO 20653:2023',system:'ISO',topic:'密封与热管理',status:'现行',level:'道路车辆零件',title:'道路车辆—电气设备外壳防护等级（IP代码）',summary:'规定道路车辆电气设备对异物、水和人员接近危险部件的防护等级及试验，需明确安装、配合与连接状态。',focus:['IP等级','防尘防水','防触及'],source:'https://www.iso.org/standard/76116.html'},
    {no:'ISO 16232:2018',system:'ISO',topic:'材料与工艺',status:'现行',level:'流体回路零件',title:'道路车辆—部件和系统的清洁度',summary:'规定颗粒污染物提取、分析和报告方法；产品清洁度限值应由图纸、系统敏感度或项目规范另行给出。',focus:['清洁度','颗粒污染','液冷回路'],source:'https://www.iso.org/standard/70267.html'},
    {no:'ISO 3601-3:2005+A1:2018',system:'ISO',topic:'密封与热管理',status:'现行',level:'O形圈',title:'流体动力系统O形圈—质量验收准则',summary:'用于O形圈表面缺陷、尺寸和质量验收；应与材料牌号、硬度、沟槽和介质兼容性要求配套。',focus:['O形圈','外观缺陷','质量验收'],source:'https://www.iso.org/standard/40409.html'},
    {no:'ISO 37:2024',system:'ISO',topic:'材料与工艺',status:'现行',level:'橡胶材料',title:'硫化或热塑性橡胶—拉伸应力应变性能',summary:'规定橡胶拉伸强度、断裂伸长率及规定伸长应力的试验方法。',focus:['橡胶','拉伸','伸长率'],source:'https://www.iso.org/standard/86892.html'},
    {no:'ISO 815-1:2019',system:'ISO',topic:'材料与工艺',status:'现行',level:'橡胶材料',title:'硫化或热塑性橡胶—压缩永久变形',summary:'规定常温和高温条件下橡胶压缩永久变形的测定方法，适用于密封寿命和压缩保持能力评价。',focus:['橡胶','压缩永久变形','密封'],source:'https://www.iso.org/standard/74943.html'},
    {no:'ISO 898-1:2013',system:'ISO',topic:'材料与工艺',status:'现行',level:'紧固件',title:'碳钢和合金钢紧固件机械性能',summary:'规定螺栓、螺钉和螺柱机械性能等级；不替代扭矩—夹紧力、疲劳或腐蚀验证。',focus:['紧固件','强度等级','机械性能'],source:'https://www.iso.org/standard/60610.html'},
    {no:'ISO 16047:2005+A1:2012',system:'ISO',topic:'材料与工艺',status:'现行',level:'螺纹紧固连接',title:'紧固件—扭矩/夹紧力试验',summary:'规定螺纹紧固件及相关零件的扭矩—夹紧力试验条件和评价方法。',focus:['扭矩','夹紧力','摩擦系数'],source:'https://www.iso.org/standard/27788.html'},
    {no:'ISO 15614-2:2025',system:'ISO',topic:'材料与工艺',status:'现行',level:'铝合金焊接',title:'金属材料焊接工艺评定—铝及铝合金电弧焊',summary:'规定铝及铝合金电弧焊工艺评定试验和认可范围，适用于焊接工艺定型。',focus:['焊接工艺评定','铝合金','电弧焊'],source:'https://www.iso.org/standard/82483.html'},
    {no:'ISO 10042:2018',system:'ISO',topic:'材料与工艺',status:'现行',level:'铝合金焊缝',title:'铝及铝合金电弧焊接头—缺欠质量等级',summary:'规定铝合金电弧焊接头缺欠的质量等级；质量等级不能单独等同于结构适用性。',focus:['焊缝','缺欠','质量等级'],source:'https://www.iso.org/standard/70566.html'},
    {no:'ISO 14125:1998+A1:2011',system:'ISO',topic:'材料与工艺',status:'现行',level:'纤维增强复合材料',title:'纤维增强塑料复合材料—弯曲性能',summary:'规定纤维增强塑料复合材料弯曲性能的测定方法。',focus:['复合材料','弯曲强度','弯曲模量'],source:'https://www.iso.org/standard/23637.html'},
    {no:'IEC 60243-1:2013',system:'IEC',topic:'电气安全',status:'现行',level:'固体绝缘材料',title:'固体绝缘材料电气强度试验—工频短时法',summary:'规定固体绝缘材料在工频下短时电气强度的试验方法；成品耐压判据仍应服从产品标准或项目规范。',focus:['电气强度','固体绝缘','耐压'],source:'https://webstore.iec.ch/en/publication/1101'},
    {no:'GB/T 10125-2021',system:'GB',topic:'环境可靠性',status:'现行',level:'材料/零件',title:'人造气氛腐蚀试验—盐雾试验',summary:'国内盐雾试验方法标准。暴露时长、样品状态和验收限值应由产品标准或项目规范定义。',focus:['盐雾','腐蚀','镀层'],source:gb('GB/T 10125-2021')},
    {no:'GB/T 4208-2017',system:'GB',topic:'电气安全',status:'现行',level:'外壳/总成',title:'外壳防护等级（IP代码）',summary:'规定外壳防尘、防水和防接近危险部件的等级与试验方法。',focus:['IP等级','防水','防触指'],source:gb('GB/T 4208-2017')},
    {no:'GB/T 228.1-2021',system:'GB',topic:'材料与工艺',status:'现行',level:'金属材料',title:'金属材料拉伸试验—室温试验方法',summary:'用于金属材料屈服强度、抗拉强度和断后伸长率等性能测定。',focus:['金属材料','拉伸','屈服强度'],source:gb('GB/T 228.1-2021')},
    {no:'GB/T 6892-2015',system:'GB',topic:'材料与工艺',status:'现行',level:'铝合金型材',title:'一般工业用铝及铝合金挤压型材',summary:'规定一般工业用铝合金挤压型材的技术要求、试验、检验和标志。',focus:['铝型材','化学成分','机械性能'],source:gb('GB/T 6892-2015')},
    {no:'GB/T 30512-2014',system:'GB',topic:'材料与工艺',status:'现行',level:'汽车材料/零件',title:'汽车禁用物质要求',summary:'用于汽车零部件和材料禁限用物质符合性管理；还应核对客户最新物质清单。',focus:['禁用物质','ELV','材料合规'],source:gb('GB/T 30512-2014')},
    {no:'UL 94',system:'UL',topic:'材料与工艺',status:'版本受控',level:'塑料/绝缘材料',title:'设备和器具塑料材料可燃性试验',summary:'常用于HB、V-0、V-1等材料燃烧等级评价；需明确试样厚度、颜色和材料牌号。',focus:['阻燃','塑料','V-0'],source:'https://www.shopulstandards.com/ProductDetail.aspx?productId=UL94'},
    {no:'IPC-TM-650',system:'IPC',topic:'材料与工艺',status:'版本受控',level:'PCB/FPC',title:'电子互连结构试验方法手册',summary:'汇集印制板和柔性电路的剥离、可焊性、微切片、绝缘和环境试验方法；应引用具体方法编号和版本。',focus:['PCB','FPC','试验方法'],source:'https://shop.ipc.org/'},
    {no:'ASTM E155 / ASTM E505',system:'ASTM',topic:'材料与工艺',status:'版本受控',level:'铝镁铸件',title:'铝镁铸件射线参考图谱',summary:'用于铸件射线底片/数字影像缺陷分类和对照；验收区域与等级需在图纸或项目规范中定义。',focus:['铸件','X射线','内部缺陷'],source:'https://www.astm.org/catalogsearch/result/?q=ASTM%20E155'},
  ];
  const existing = new Set(lib.records.map((r) => r.no));
  lib.records.push(...records.filter((r) => !existing.has(r.no)));

  global.DVPR_STANDARD_SUPPLEMENT = {
    standards: Object.fromEntries(records.map((r) => [r.no, {family:r.system,title:r.title,url:r.source}])),
    recommendations: {
      casting:['ASTM E155 / ASTM E505','GB/T 228.1-2021'], 'extrusion-profile':['GB/T 6892-2015','GB/T 228.1-2021'],
      'composite-material':['ISO 14125:1998+A1:2011'], 'surface-treatment':['ISO 9227:2022','GB/T 10125-2021'],
      'corrosion-protection':['ISO 9227:2022','GB/T 10125-2021'], 'leak-tightness':['ISO 20653:2023','GB/T 4208-2017'],
      welding:['ISO 15614-2:2025','ISO 10042:2018'], fastener:['ISO 898-1:2013','ISO 16047:2005+A1:2012'],
      plastic:['UL 94','IEC 60243-1:2013'], 'rubber-o-ring':['ISO 3601-3:2005+A1:2018','ISO 37:2024','ISO 815-1:2019'],
      'sealing-gasket':['ISO 37:2024','ISO 815-1:2019','IEC 60243-1:2013'], 'lv-harness':['GB/T 30512-2014'],
      'water-quick-connect-gen1':['ISO 16232:2018','ISO 20653:2023'], 'water-quick-connect-gen2':['ISO 16232:2018','ISO 20653:2023'],
      'bottom-cooling-plate':['ISO 16232:2018','ISO 9227:2022'], 'side-cooling-plate':['ISO 16232:2018','ISO 9227:2022'],
      'cell-elastomer':['IEC 60243-1:2013','UL 94'], 'vent-valve':['ISO 20653:2023','ISO 9227:2022'],
      aerogel:['IEC 60243-1:2013','UL 94'], 'bottom-protection-foam':['IEC 60243-1:2013','UL 94'],
      'upper-support-foam':['IEC 60243-1:2013','UL 94'], 'outer-insulation-foam':['IEC 60243-1:2013','UL 94'],
      'electric-swap-connector':['ISO 20653:2023','GB/T 4208-2017'], fpc:['IPC-TM-650','GB/T 30512-2014'],
      'cu-busbar':['ISO 9227:2022','IEC 60243-1:2013','GB/T 30512-2014'], 'al-busbar':['ISO 9227:2022','IEC 60243-1:2013','GB/T 30512-2014']
    },
    profiles: {
      casting:[['射线检测','ASTM E155 / ASTM E505','参考图谱范围；验收区域和等级按受控图纸确认','3','外观、批次和关键尺寸','按铸件厚度和设备能力','按批准的射线检测工艺采集并评级','缺陷类型、位置和等级','满足图纸/SOR规定的区域与等级']],
      'extrusion-profile':[['室温拉伸性能','GB/T 228.1-2021','室温拉伸试验方法','3','材料牌号、状态和尺寸','室温；取样方向受控','测定屈服、抗拉强度和伸长率','强度和伸长率','满足材料规范及图纸限值']],
      'composite-material':[['弯曲性能','ISO 14125:1998+A1:2011','纤维增强复合材料弯曲试验','5','试样尺寸和纤维方向','标准状态调节','按适用方法完成弯曲试验','弯曲强度、模量和失效模式','满足材料规范/项目限值']],
      'surface-treatment':[['中性盐雾','ISO 9227:2022','NSS方法；暴露时长和判据按项目定义','5','膜厚、外观和划线状态','35 °C；5% NaCl；样品状态按项目','按NSS方法暴露规定时长','腐蚀面积、起泡、锈蚀和附着力','满足图纸/SOR规定的时长与腐蚀等级']],
      'corrosion-protection':[['腐蚀防护验证','GB/T 10125-2021','盐雾试验方法；不自动定义产品限值','5','镀层、外观和连接电阻','按项目选择NSS/AASS/CASS','完成规定暴露并恢复','腐蚀等级、外观和功能','满足项目腐蚀等级及功能限值']],
      'leak-tightness':[['防护等级','ISO 20653:2023','道路车辆电气设备IP试验','5','泄漏率、外观和功能','明确装车、连接和配合状态','按目标IP代码执行','进水/进尘、泄漏率和功能','满足目标IP等级及项目泄漏率']],
      welding:[['焊接工艺评定','ISO 15614-2:2025','铝及铝合金电弧焊工艺评定','1套','WPS、材料和试板状态','受控焊接参数和材料批次','完成试板、无损及破坏性检验','缺欠、强度和宏观组织','工艺评定合格且覆盖产品参数范围']],
      fastener:[['扭矩—夹紧力','ISO 16047:2005+A1:2012','紧固件扭矩/夹紧力试验','10','紧固件、涂层和摩擦副状态','受控速度、垫片和润滑状态','记录拧紧过程扭矩与夹紧力','摩擦系数、夹紧力和失效模式','满足连接设计窗口']],
      'rubber-o-ring':[['压缩永久变形','ISO 815-1:2019','常温或高温压缩永久变形方法','5','硬度、尺寸和材料批次','温度、压缩率和时长按材料规范','老化、恢复后测量厚度','压缩永久变形率','满足密封材料规范限值']],
      'sealing-gasket':[['拉伸性能','ISO 37:2024','橡胶拉伸应力应变方法','5','厚度、材料批次','标准状态调节','测定拉伸强度和断裂伸长率','强度、伸长率和失效模式','满足材料规范限值']],
      'water-quick-connect-gen1':[['流道清洁度','ISO 16232:2018','颗粒提取、分析和报告方法','5','封堵、质量和初始洁净状态','受控洁净环境','提取流道颗粒并进行重量/尺寸分析','颗粒质量、数量和最大尺寸','满足项目清洁度限值']],
      'water-quick-connect-gen2':[['流道清洁度','ISO 16232:2018','颗粒提取、分析和报告方法','5','封堵、质量和初始洁净状态','受控洁净环境','提取流道颗粒并进行重量/尺寸分析','颗粒质量、数量和最大尺寸','满足项目清洁度限值']],
      'bottom-cooling-plate':[['流道清洁度','ISO 16232:2018','液冷回路颗粒污染分析方法','3','流道封堵和初始泄漏率','受控洁净环境','冲洗提取并分析颗粒','颗粒质量、数量和最大尺寸','满足冷却系统项目限值']],
      'side-cooling-plate':[['流道清洁度','ISO 16232:2018','液冷回路颗粒污染分析方法','3','流道封堵和初始泄漏率','受控洁净环境','冲洗提取并分析颗粒','颗粒质量、数量和最大尺寸','满足冷却系统项目限值']],
      'cell-elastomer':[['电气强度','IEC 60243-1:2013','固体绝缘材料工频短时法','5','厚度、含水率和外观','电极、介质和升压速率受控','按材料厚度施加试验电压','击穿电压和击穿位置','满足材料规范规定的电气强度']],
      'vent-valve':[['防尘防水与泄压后防护','ISO 20653:2023','道路车辆IP代码','5','开启压力、气密和外观','装车方向及配合状态','完成目标IP并复测开启/关闭特性','进水/进尘、开启压力和复位','满足目标IP及泄压功能限值']],
      aerogel:[['电气强度','IEC 60243-1:2013','固体隔热绝缘材料短时电气强度','5','厚度、含水率和外观','电极和介质按受控方法','完成短时耐电强度试验','击穿电压和位置','满足材料规范限值']],
      'bottom-protection-foam':[['电气强度','IEC 60243-1:2013','固体绝缘材料短时法','5','厚度和状态','干态及项目要求的湿态','完成规定电气强度试验','击穿电压和位置','满足材料规范限值']],
      'upper-support-foam':[['电气强度','IEC 60243-1:2013','固体绝缘材料短时法','5','厚度和状态','干态及项目要求的湿态','完成规定电气强度试验','击穿电压和位置','满足材料规范限值']],
      'outer-insulation-foam':[['阻燃性能','UL 94','材料燃烧等级；试样厚度须与零件一致','5','材料牌号、颜色和厚度','标准状态调节','按目标等级完成燃烧试验','燃烧时间、滴落和损伤长度','达到项目指定UL 94等级']],
      'electric-swap-connector':[['防护等级','ISO 20653:2023','道路车辆电气设备IP代码','5','绝缘、气密和功能','明确配合/非配合及装车状态','按目标IP代码完成试验','进水/进尘、绝缘、互锁和功能','满足目标IP及换电接口功能要求']],
      fpc:[['材料/互连试验','IPC-TM-650','具体方法编号按验证项目选择','5','材料批次、外观和网络电阻','按具体方法规定','完成剥离、可焊性或绝缘等选定试验','对应机械/电气结果','满足图纸、IPC产品等级和项目限值']],
      'cu-busbar':[['盐雾耐腐蚀','ISO 9227:2022','NSS方法；项目定义时长与判据','5','镀层、外观和连接电阻','按装车界面和项目时长','完成盐雾暴露并恢复','腐蚀、镀层和连接电阻','满足项目腐蚀等级及电阻变化限值']],
      'al-busbar':[['盐雾/电偶腐蚀','ISO 9227:2022','NSS方法；异种金属界面状态受控','5','表面处理、外观和连接电阻','按装车界面和项目时长','完成盐雾暴露并恢复','腐蚀、界面和连接电阻','无有害电偶腐蚀且电阻满足限值']]
    }
  };
})(window);
