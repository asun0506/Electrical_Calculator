/** 动力电池电气系统三级 DFMEA 底库。 */
(function (global) {
  'use strict';

  const requirementRows = global.DFMEA_SYSTEM_REQUIREMENTS || [
    [1,'Voltage','Voltage Ripple – Peak to Peak\nThe HV ESS shall withstand a peak-to-peak voltage ripple on the HV DC bus, without functional de-rate or damage. The voltage ripple may be no greater than:'],
    [2,'Safety','McLaren High Voltage Safety Specification\nThe HV ESS shall comply with the McLaren High Voltage Safety specification.'],
    [3,'Contactors','Main Contactors\nThe HV ESS shall provide suitably rated HV contactors/switches on both the positive and negative DC lines. The contactors shall be selected in combination with the main pack fuse to isolate the pack in all operational and fault current conditions. The HV contactors shall normally be open.'],
    [4,'Contactors','Main contactors total number of cycles\nMain contactors shall be capable of operating for 120,000 cycles.'],
    [5,'Contactors','Contactor Power Supply\nThe HV ESS shall use only the 12V KL30C power supply from the vehicle to energise contactors.'],
    [6,'Over-current','Over-Current: Cell-String HV DC Fuse\nThe HV ESS shall contain an appropriately rated fault current interruption device in series with the cell-string.'],
    [7,'Over-current','Over-Current: Ancillary HV DC Fuses\nThe HV ESS shall incorporate appropriately rated fault current interruption devices on ancillary HV DC links. Devices shall be serviceable without removing the main ESS cover.'],
    [8,'Over and under voltage','Upper Voltage for Self-protection\nThe value of the upper voltage for self-protection is 450 V.'],
    [9,'Over and under voltage','Lower Voltage for Self-protection\nThe value of the lower voltage for self-protection is 240 V.'],
    [10,'Isolation','Isolation Design\nHV components shall be isolated from the chassis to ISO 6469-1:2019. HV ESS isolation resistance shall exceed 500 Ω/V.'],
    [11,'High Voltage Interlock','HVIL: Design\nThe HVIL loop shall travel from the ESS vehicle LV connector to BMU connector, HV DC link and auxiliary DC link, with HVIL IN/HVIL OUT.'],
    [12,'Electric Shock Protection','Finger-Proofing: fully assembled with connectors attached\nThe fully assembled HV ESS with connectors and covers attached shall meet IPxxD.'],
    [13,'Electric Shock Protection','Finger-Proofing: fully assembled without connectors attached\nThe fully assembled HV ESS without external connectors and with covers attached shall meet IPxxB.'],
    [14,'Electric Shock Protection','Equipotential Bonding\nConductive components not designed as HV conductors shall be bonded to chassis ground per ISO 6469-3 and ECE R100.'],
    [15,'Low Voltage','12V Power Supply – Voltage range\nAll 12V components and harnesses must operate from 9–16 V.'],
    [16,'Low Voltage','12V Power Supply – Current draw\nExcept contactor coils, the HV ESS shall use KL30/KL31 and draw no more than 12 A from KL30.'],
    [17,'Low Voltage','12V Power Supply Performance\nThe HV ESS electrical system shall meet the referenced performance specification under defined operating scenarios.'],
    [18,'Low Voltage','12V Power Supply – Power distribution\nAll LV components on the pack must be powered by KL30 apart from main contactors.'],
    [19,'Service Requirements','Serviceability – current interrupting devices\nCurrent interrupting devices shall be serviceable through an access panel.'],
    [20,'Low Voltage Interfaces','Low Voltage Connector\nProvide an LV connection interface for all required low-voltage signal and power connections.'],
    [21,'Low Voltage Interfaces','Connection to Chassis Ground\nProvide a separate conductive equipotential-bonding connection to chassis ground with resistance below 0.1 Ω.'],
    [22,'High Voltage Interfaces','MCU HV Bus Connection Front\nProvide a front MCU HV DC connection for maximum current, temperature and voltage, compatible with TE CSJ1800, 50 mm².'],
    [23,'High Voltage Interfaces','MCU HV Bus Connection Rear\nProvide a rear MCU HV DC connection for maximum current, temperature and voltage, compatible with TE CSJ1800, 50 mm².'],
    [24,'High Voltage Interfaces','Auxiliary HV Bus Connections\nProvide HV DC connections for auxiliaries, compatible with a 4-pole connection and 4/6 mm² conductors.'],
    [25,'High Voltage Interfaces','OBC HV Bus Connection\nProvide a charger HV DC connection for the required power, compatible with TE HD400 straight connection and 6 mm² conductor.'],
    [26,'High Voltage Interfaces','Serviceability\nHV connections shall not require a special tool to mate or un-mate.'],
    [27,'High Voltage Interfaces','Colour\nHV connectors shall be RAL 2001 orange unless an approved deviation exists.'],
    [28,'High Voltage Interfaces','Poka-Yoke\nConnections shall physically prevent mating in an incorrect orientation or position.'],
    [29,'High Voltage Interfaces','Ingress Protection – mated connections\nAll vehicle connections in the mated condition shall meet IP6K9.'],
    [30,'High Voltage Interfaces','Finger-Proofing\nConnections shall meet IPxxB in both mated and unmated conditions.'],
    [31,'High Voltage Interfaces','HVIL\nHV connections shall include two HVIL contacts; HVIL shall make after the main power contacts and be mechanically enforced.'],
    [32,'Wiring harness requirements','Temperature rise of Harness\nNew/redesigned wiring harnesses shall meet ISO 19642-7 Class B.'],
    [33,'Wiring harness requirements','Temperature rise of HV Harness – main DC path\nNew/redesigned HV harnesses shall meet ISO 19642-7 Class C.'],
    [34,'Wiring harness requirements','HV Wiring Harness Colour\nAll HV wiring harnesses shall be RAL 2001 orange.'],
    [35,'Pre-charge','Pre-Charge circuit consecutive cycles\nThe pre-charge contactor and resistor shall support 20 consecutive cycles at 2 s intervals.'],
    [36,'Pre-charge','Pre-Charge circuit total number of cycles\nThe pre-charge circuit shall support 120,000 total cycles.'],
    [37,'Pre-charge','Pre-Charge Time\nFrom vehicle wake-up to confirmation that main contactors are closed shall not exceed 1.0 s.'],
  ];

  const A = [
    ['汇流排/高压线束','限制回路阻抗并承受母线纹波','直流母线纹波超限','导体阻抗或回路参数不匹配','阻抗预算、纹波仿真与器件降额校核',8,3,'母线纹波与温升台架测试',3],
    ['全部电气件','符合适用的高压电安全要求','系统不符合高压安全规范','安全要求分解遗漏或接口边界不清','法规/规范清单、需求追溯和安全设计评审',10,2,'电安全测试与合规审查',4],
    ['EDM/主继电器','接通并在故障时隔离主回路','主回路不能可靠接通或分断','继电器额定能力不足、触点熔焊或线圈失效','负载谱选型、保险丝配合与触点降额校核',10,3,'分断、短路配合和粘连诊断试验',3],
    ['EDM/主继电器','满足全寿命开关循环','触点寿命不足','电弧侵蚀、机械磨损或线圈热老化','寿命模型、负载谱与降额设计',9,4,'耐久循环与接触电阻监测',4],
    ['低压线束/主继电器线圈','由KL30C稳定驱动接触器','接触器不能按指令动作','供电范围不兼容、压降过大或回路开路','线圈功耗预算、压降与接口校核',9,3,'9–16 V边界与故障注入试验',3],
    ['保险丝盒/Pyro-fuse','切断电芯串故障电流','主回路过流不能及时切断','额定值、I²t或短路容量选择不当','短路电流计算、时间电流配合与降额设计',10,3,'短路分断和保护配合试验',3],
    ['保险丝盒/辅助回路保险丝','切断辅助高压支路故障电流并可维护','辅助支路保护失效或不可维护','保险丝规格不匹配、布置不可达或接口过热','支路负载谱、保护配合与维修性评审',9,3,'分断、温升及维修操作验证',4],
    ['EDM/转接PCB','准确采样并执行过压保护阈值','过压保护不动作或误动作','采样偏差、阈值配置错误或信号开路','采样链误差预算、阈值评审和诊断设计',10,2,'过压边界、故障注入与标定验证',3],
    ['EDM/转接PCB','准确采样并执行欠压保护阈值','欠压保护不动作或误动作','采样偏差、阈值配置错误或供电异常','采样链误差预算、阈值评审和诊断设计',8,3,'欠压边界、故障注入与标定验证',3],
    ['高压线束/高压连接器','维持高压对车身绝缘','绝缘电阻低于要求','污染、绝缘材料失效、间隙不足或装配损伤','材料选型、电气间隙/爬电距离与密封设计',10,3,'绝缘电阻、耐压、湿热后复测',3],
    ['高压线束/互锁低压线缆','形成完整且时序正确的HVIL回路','互锁断路未识别或错误闭合','端子退针、线路短路或接口定义错误','HVIL拓扑、端子保持力与诊断覆盖评审',10,3,'开短路故障注入及插拔时序试验',3],
    ['高压连接器/壳体防护','带电部件不可触及','装配状态下手指可触及带电件','结构开口、装配间隙或防护罩不足','IP探针可达性分析与结构防错',10,2,'IPxxD探针验证',3],
    ['高压连接器/壳体防护','未插合状态下防止触电','未插合状态可触及带电件','端子前端防护或盖板设计不足','IP探针可达性分析与端子护套设计',10,2,'IPxxB探针验证',3],
    ['低压线束/低压OT端子','将可导电外壳可靠连接车身地','等电位连接中断或阻值过大','端子松动、腐蚀、线径不足或搭铁面污染','接地拓扑、截面积和防腐设计',10,3,'接地连续性、压降和环境后阻值测试',3],
    ['低压线束/低压连接器','在9–16 V范围内供电与传输信号','边界电压下功能降级或复位','器件工作范围不足、线束压降或接触不良','供电预算、压降分析与器件降额',8,3,'9–16 V边界、冷启动和瞬态试验',3],
    ['低压线束/线缆','限制KL30静态与动态电流','整包低压电流超过12 A','负载预算遗漏、休眠异常或短路泄漏','低压功耗预算和休眠策略评审',7,3,'电流map、休眠电流和故障注入测试',3],
    ['低压线束/低压连接器','在规定工况下保持低压供电性能','瞬态工况下供电中断或信号异常','瞬态抗扰不足、连接压降或接地弹跳','电源完整性、瞬态保护和接地设计',8,3,'电源瞬态与场景联调测试',4],
    ['低压线束/保险丝盒','按KL30架构向低压负载分配电源','负载供电来源错误或支路失电','拓扑设计错误、分支开路或保险丝错配','电源分配图、接口矩阵和回路校核',8,3,'整车接口与逐支路通断检查',3],
    ['保险丝盒/保险丝','允许通过检修口更换保护器件','保护器件不可维修或误操作','检修空间不足、标识不清或紧固不可达','维修包络、工具空间和防错评审',6,3,'实车维修性验证',3],
    ['低压线束/低压连接器','提供完整低压电源与信号接口','接口缺针、错针或接触不可靠','针脚定义错误、端子退针或锁止不足','接口控制文件、针脚复核和端子选型',8,3,'导通、错针、保持力与振动后测试',3],
    ['低压线束/低压OT端子','提供独立低阻等电位接地路径','车身接地电阻超过0.1 Ω','压接不良、搭铁面污染或紧固松动','压接窗口、表面处理和扭矩规范',10,3,'四线法电阻及环境后复测',3],
    ['高压线束/前端高压连接器','向前MCU传输额定高压功率','前MCU供电中断或接口过热','线径不足、接触电阻过大或额定值不足','电流map、线径、温升和接口额定校核',9,3,'温升、压降、振动后接触电阻测试',3],
    ['高压线束/后端高压连接器','向后MCU传输额定高压功率','后MCU供电中断或接口过热','线径不足、接触电阻过大或额定值不足','电流map、线径、温升和接口额定校核',9,3,'温升、压降、振动后接触电阻测试',3],
    ['高压线束/辅助高压连接器','向辅助负载传输高压功率','辅助支路失电、错接或过热','极数/线径不匹配、接触不良或针脚错误','接口矩阵、线径和额定值校核',8,3,'针脚、温升、压降和耐久试验',4],
    ['高压线束/OBC高压连接器','向OBC可靠传输充电功率','充电中断或接口过热','连接器/线径额定不足或接触电阻过大','充电工况负载谱、温升与接口校核',9,3,'充电温升、压降与耐久试验',3],
    ['高压连接器/锁止机构','无需特殊工具完成插拔维护','连接器无法正常拆装或被损伤','锁止力过大、空间不足或防护件干涉','人机工程与维修包络评审',5,3,'实车插拔与重复耐久验证',3],
    ['高压连接器/外观标识','通过橙色外观识别高压接口','高压接口颜色不符合要求','材料色差、供应商偏差或标识遗漏','色板、材料规范和来料限度样件',5,3,'色差仪和目视检验',2],
    ['高压连接器/防错键位','防止错误方向或错误接口插合','错误插合导致错接或短路','键位区分不足、结构公差或装配错件','接口唯一化、防错分析和公差校核',10,2,'错插试验和装配防错验证',2],
    ['高压连接器/密封系统','插合后阻止水尘进入','插合状态密封失效','密封圈损伤、压缩量不足或锁止不到位','密封压缩率、公差链和界面设计',9,3,'IP6K9、热循环后泄漏验证',3],
    ['高压连接器/端子防护','插合及未插合时防止触电','可触及带电端子','护套损伤、退针或开口尺寸过大','端子前端防护、TPA和公差设计',10,2,'IPxxB探针与退针检查',3],
    ['高压连接器/互锁端子','保证HVIL晚接早断时序','互锁时序错误或信号不连续','互锁端子长度、位置或保持力异常','端子时序尺寸链和保持力设计',10,3,'插拔时序、微动与故障注入测试',3],
    ['低压线束/线缆','满足ISO 19642-7 Class B温升要求','低压线束温升超限','线径不足、束径降额或接触电阻过大','RMS电流、线径与环境降额计算',8,3,'电流map温升和热稳态测试',3],
    ['高压线束/高压线缆','满足ISO 19642-7 Class C温升要求','主高压路径温升超限','线径不足、屏蔽/束径降额或端接过热','RMS电流、线径与端接温升校核',9,3,'主回路温升、压降和热循环测试',3],
    ['高压线束/高压线缆','以RAL 2001标识高压线束','高压线束颜色错误','护套材料色差或错料','图纸颜色要求、色板和防错清单',5,3,'来料色差与装配目检',2],
    ['EDM/预充继电器与预充电阻','连续完成规定间隔的预充循环','连续预充时过热或无法完成预充','电阻热容量不足、继电器触点粘连或控制间隔错误','预充能量、热容量和循环策略校核',9,4,'20次连续循环温升与波形测试',3],
    ['EDM/预充继电器','满足全寿命预充开关循环','预充回路寿命不足','触点侵蚀、电阻热老化或控制频繁动作','寿命负载谱与器件降额设计',8,4,'120000次耐久与参数漂移监测',4],
    ['EDM/预充回路','在1.0 s内完成母线预充并闭合主继电器','预充超时、过快或主继电器不能闭合','预充电阻偏差、母线电容变化、采样或控制异常','RC计算、阈值/时序及最差工况仿真',9,3,'预充时间、母线波形和故障注入测试',3],
  ];

  function row(level, id, c, d, e, f, g, h, i, s, k, l, m, o, dc, detect, tags) {
    return { level, id, C:c||'', D:d||'', E:e||'', F:f||'', G:g||'', H:h||'', I:i||'', J:s, K:k||'', L:l||'', M:m||'', N:o, O:dc||'', P:detect, tags:tags||[] };
  }

  const system = requirementRows.map((req, index) => {
    const a = A[index];
    return row(1, `SYS-${String(req[0]).padStart(2,'0')}`, '', '电气系统', a[0], '', req[2], a[1], '', a[5], a[2], a[3], a[4], a[6], a[7], a[8], ['电气系统',req[1]]);
  });
  [
    row(1,'SYS-38','','电气系统','EDM/霍尔传感器、保险丝盒/Shunt','','Measure pack charge and discharge current with specified accuracy','Convert primary current into an accurate, isolated signal','','9','Pack current measurement is incorrect','Current sensor offset, gain or signal path is abnormal','Current range, bandwidth, thermal drift and accuracy-budget review',3,'Full-temperature calibration, pulse-current and fault-injection test',4,['电气系统','Current measurement']),
    row(1,'SYS-39','','电气系统','FPC','','Acquire cell voltage and temperature signals continuously','Connect every cell/temperature sensing point to the acquisition circuit','','10','Cell voltage or temperature is measured incorrectly','Sampling path is open, shorted, resistive or cross-coupled','Sampling topology, diagnostic coverage, insulation and routing review',4,'Open/short injection, full-temperature accuracy and insulation test',4,['电气系统','Cell monitoring']),
    row(1,'SYS-40','','电气系统','低压线束/水温传感器','','Measure coolant temperature for battery thermal control','Convert coolant temperature into a valid control signal','','9','Coolant over-temperature is not detected correctly','Temperature sensor or signal path is inaccurate or interrupted','Range, response time, mounting thermal resistance and diagnostic review',3,'Calibration, response-time, open/short and ingress test',4,['电气系统','Thermal monitoring']),
    row(1,'SYS-41','','电气系统','电芯巴片','','Connect cells in the specified series/parallel topology with low resistance','Maintain welded electrical and mechanical continuity between cells','','10','Cell series/parallel connection is interrupted or overheats','Cell tab material, geometry or weld joint is abnormal','Current distribution, conductor sizing and weld-window review',4,'Four-wire resistance, weld strength, temperature-rise and CT inspection',4,['电气系统','Cell interconnection']),
    row(1,'SYS-42','','电气系统','EDM铜排、保险丝盒铜排、汇流排','','Distribute high-voltage current inside the pack with low loss and stable insulation','Carry peak/RMS current and maintain required insulation spacing','','10','Internal HV distribution opens, overheats or shorts','Busbar resistance, joint, support or insulation spacing is inadequate','Current map, resistance/thermal, mechanical support and insulation-coordination review',3,'Resistance, temperature-rise, vibration, dielectric and insulation test',3,['电气系统','Internal HV distribution']),
    row(1,'SYS-43','','电气系统','全部电气零部件','','绝缘：500V电压下，整包绝缘电阻≥200MΩ','各电气零部件在500V电压下保持绝缘电阻≥500MΩ','','10','整包绝缘电阻低于200MΩ','一个或多个电气零部件绝缘电阻低于500MΩ','绝缘材料、绝缘距离、污染控制和装配防护设计',3,'500V整包绝缘电阻测试',3,['电气系统','绝缘']),
    row(1,'SYS-44','','电气系统','全部电气零部件','','耐压：2700V电压下，整包漏电流≤1mA','各电气零部件在2700V电压下保持漏电流≤0.1mA','','10','2700V耐压时整包漏电流超过1mA','一个或多个电气零部件耐压漏电流超过0.1mA','耐压等级、电气间隙、绝缘材料与制造缺陷控制',3,'2700V整包耐压及漏电流测试',3,['电气系统','耐压']),
    row(1,'SYS-45','','电气系统','','','电气间隙满足IEC 60664','','','10','电气间隙不满足IEC 60664','','工作电压、过电压类别、污染等级和海拔校核',3,'系统级电气间隙尺寸检验',3,['电气系统','电气间隙']),
    row(1,'SYS-46','','电气系统','','','爬电距离满足IEC 60664','','','10','爬电距离不满足IEC 60664','','工作电压、材料组别、污染等级和表面路径校核',3,'系统级爬电距离尺寸检验',3,['电气系统','爬电距离']),
  ].forEach((item)=>system.push(item));

  const systemByNo = new Map(system.map((item, index) => [index + 1, item]));
  function component(parentNo,id,focus,child,focusFunction,childFunction,failureMode,childFailure,prevention,occurrence,detection,detectability,tags){
    const parent=systemByNo.get(parentNo);
    return row(2,id,parent.D,focus,child,parent.G,focusFunction,childFunction,parent.K,parent.J,failureMode,childFailure,prevention,occurrence,detection,detectability,[focus,...(tags||[])]);
  }
  const l2 = [
    component(3,'L2-EDM-01','EDM（电源分配单元）','主继电器','按控制指令接通高压主回路','闭合正负极主触点并保持低接触电阻','主回路无法接通','主继电器不能闭合','线圈电压、吸合裕量和触点额定值校核',3,'边界电压吸合与接触电阻测试',3,['主继电器']),
    component(3,'L2-EDM-02','EDM（电源分配单元）','主继电器','在停机或故障时隔离高压母线','分断运行及故障电流','主回路无法分断','主继电器触点粘连','分断能力、保险丝配合和触点降额校核',3,'故障电流分断与粘连诊断测试',3,['主继电器']),
    component(4,'L2-EDM-03','EDM（电源分配单元）','主继电器','在全寿命内完成主回路开关','在额定负载下完成120000次动作','主回路开关寿命不足','主继电器触点磨损超限','负载谱、触点能量和机械寿命校核',4,'全寿命循环及接触电阻监测',4,['主继电器']),
    component(5,'L2-EDM-04','EDM（电源分配单元）','主继电器','使用KL30C驱动主继电器','在线路压降后获得足够线圈电压','主继电器驱动电源不兼容','主继电器线圈欠压不吸合','线圈功耗和KL30C压降预算',3,'9–16V边界动作与故障注入测试',3,['主继电器']),
    component(35,'L2-EDM-05','EDM（电源分配单元）','预充继电器','按控制时序连续执行预充循环','每个循环接通并断开预充支路','连续预充循环中断','预充继电器不能闭合','线圈裕量、触点额定值和循环间隔校核',4,'20次连续预充波形与温升测试',3,['预充继电器']),
    component(35,'L2-EDM-06','EDM（电源分配单元）','预充继电器','按控制时序连续执行预充循环','每个循环结束后可靠断开预充支路','连续预充循环中断','预充继电器触点粘连','触点能量、断开时序和粘连诊断设计',3,'连续循环后的粘连诊断测试',3,['预充继电器']),
    component(35,'L2-EDM-07','EDM（电源分配单元）','预充电阻','限制连续预充循环的浪涌电流','在每次预充中限制电流并耗散电容能量','连续预充时温升超限','预充电阻过热','脉冲能量、平均功率和散热间隔校核',4,'20次连续循环温升与阻值漂移测试',3,['预充电阻']),
    component(35,'L2-EDM-08','EDM（电源分配单元）','预充电阻','建立连续可用的预充电流路径','在每次预充中保持设计阻值','连续预充循环中断','预充电阻开路','脉冲耐量、端接应力和材料降额设计',3,'连续脉冲后导通与阻值测试',3,['预充电阻']),
    component(36,'L2-EDM-09','EDM（电源分配单元）','预充继电器','在全寿命内接通预充支路','完成120000次预充动作','预充回路寿命不足','预充继电器机械寿命不足','动作次数、负载谱与触点降额设计',4,'120000次动作耐久与参数监测',4,['预充继电器']),
    component(36,'L2-EDM-10','EDM（电源分配单元）','预充电阻','在全寿命内保持预充阻值','承受全寿命累计脉冲能量','预充回路寿命不足','预充电阻阻值漂移超限','累计脉冲能量、热老化和材料稳定性设计',4,'寿命循环后的阻值与绝缘测试',4,['预充电阻']),
    component(37,'L2-EDM-11','EDM（电源分配单元）','预充继电器','按预充时序接通预充支路','在唤醒后规定时刻闭合触点','预充时间超过1.0s','预充继电器吸合延迟','驱动响应时间和软件时序预算',3,'低温低压下吸合时间与预充波形测试',3,['预充继电器']),
    component(37,'L2-EDM-12','EDM（电源分配单元）','预充电阻','在1.0s内将母线充至主继电器闭合阈值','以设计RC常数限制电流并提升母线电压','预充时间超过1.0s','预充电阻阻值过大','母线电容、阻值公差及最差RC计算',3,'全温阻值和预充时间边界测试',3,['预充电阻']),
    component(37,'L2-EDM-13','EDM（电源分配单元）','预充电阻','限制预充初始浪涌电流','以设计阻值限制初始电流','预充过快且浪涌超限','预充电阻阻值过小','最小阻值、母线电容与峰值电流校核',3,'最小阻值样件的浪涌电流测试',3,['预充电阻']),
    component(8,'L2-EDM-14','EDM（电源分配单元）','转接PCB','传递过压采样和保护信号','保持采样通道增益和连接完整','过压保护不动作','转接PCB采样通道开路','采样链路、连接器针脚和诊断覆盖评审',3,'过压边界及采样开路故障注入',3,['转接PCB']),
    component(9,'L2-EDM-15','EDM（电源分配单元）','转接PCB','传递欠压采样和保护信号','保持采样通道精度和基准稳定','欠压保护误动作','转接PCB采样偏差超限','误差预算、基准和布线抗扰设计',3,'欠压阈值、全温精度和EMC测试',4,['转接PCB']),
    component(1,'L2-EDM-16','EDM（电源分配单元）','EDM铜排','低阻传输直流母线电流','以足够截面积传输峰值及RMS电流','EDM输出纹波或压降超限','EDM铜排电阻过大','材料、截面积、搭接面和紧固校核',3,'四线法电阻、压降和温升测试',3,['EDM铜排']),
    component(10,'L2-EDM-17','EDM（电源分配单元）','EDM铜排','维持高压母线对壳体绝缘','与壳体及异电位导体保持绝缘距离','EDM内部绝缘性能不足','EDM铜排对壳间距不足','电气间隙、爬电距离与绝缘材料校核',3,'耐压、绝缘电阻和环境后复测',3,['EDM铜排']),
    component(38,'L2-EDM-18','EDM（电源分配单元）','霍尔传感器','测量主回路充放电电流','在量程和带宽内输出准确电流信号','主回路电流测量偏差','霍尔传感器零点漂移','量程、温漂、磁路和供电误差预算',3,'全温零点、线性度和脉冲电流测试',4,['霍尔传感器']),
    component(38,'L2-EDM-19','EDM（电源分配单元）','霍尔传感器','测量主回路充放电电流','在最大电流下保持线性输出','大电流测量值失真','霍尔传感器磁饱和','最大量程、磁芯气隙和峰值电流裕量校核',3,'峰值脉冲电流和饱和恢复测试',4,['霍尔传感器']),

    component(6,'L2-FUSE-01','保险丝盒','Pyro-fuse','切断电芯串严重故障电流','接收触发后快速分断主高压回路','主回路故障电流未切断','Pyro-fuse拒爆','触发能量、分断容量和接口安全分析',2,'触发边界与最大短路电流分断测试',3,['Pyro-fuse']),
    component(6,'L2-FUSE-02','保险丝盒','Pyro-fuse','正常工况保持主高压回路导通','未收到有效触发时保持低阻导通','正常工况主回路被误切断','Pyro-fuse误爆','触发逻辑、抗扰和点火回路诊断设计',2,'EMC、误触发和故障注入测试',3,['Pyro-fuse']),
    component(7,'L2-FUSE-03','保险丝盒','辅助回路保险丝','切断辅助支路过流','故障电流下按时间电流曲线熔断','辅助支路过流未切断','辅助回路保险丝应断未断','负载谱、I²t和短路容量配合',3,'时间电流特性和短路分断测试',3,['辅助回路保险丝']),
    component(7,'L2-FUSE-04','保险丝盒','辅助回路保险丝','正常负载下保持辅助支路供电','承受允许的持续及瞬态电流','辅助支路正常工况误断','辅助回路保险丝误熔断','持续电流、脉冲和环境温度降额',3,'脉冲耐受、温升和寿命测试',3,['辅助回路保险丝']),
    component(19,'L2-FUSE-05','保险丝盒','辅助回路保险丝','支持通过检修口更换保险丝','在规定工具和空间内拆装','保险丝不可维护','辅助回路保险丝无法从检修口拆出','维修包络、抓取空间和防错设计',3,'实车拆装与维修时间验证',3,['辅助回路保险丝']),
    component(38,'L2-FUSE-06','保险丝盒','Shunt（电流传感器）','测量整包充放电电流','以稳定电阻和Kelvin端输出压差信号','整包电流测量偏差','Shunt阻值漂移超限','功率、温漂、材料和Kelvin连接设计',3,'全温精度、过载和热循环测试',4,['Shunt（电流传感器）']),
    component(38,'L2-FUSE-09','保险丝盒','Shunt（电流传感器）','连续输出整包电流采样信号','通过Kelvin采样端保持测量回路连续','整包电流信号丢失','Shunt采样端开路','Kelvin端结构、焊接应力和连接诊断设计',3,'采样端开路注入、振动和热循环测试',3,['Shunt（电流传感器）']),
    component(1,'L2-FUSE-07','保险丝盒','保险丝盒铜排','向主支路低阻分配高压电流','以足够截面积承载支路RMS电流','保险丝盒母线压降超限','保险丝盒铜排电阻过大','分流路径、截面积和搭接界面校核',3,'四线法电阻、支路压降和温升测试',3,['保险丝盒铜排']),
    component(10,'L2-FUSE-08','保险丝盒','保险丝盒铜排','维持不同电位回路间绝缘','保持规定电气间隙和爬电距离','保险丝盒内部绝缘失效','保险丝盒铜排间距不足','绝缘配合、公差链和污染等级校核',3,'耐压、绝缘电阻和湿热测试',3,['保险丝盒铜排']),

    component(15,'L2-LV-01','低压线束','低压连接器','在9–16V范围连接整车低压电源','维持电源端子连续接触','边界电压下低压供电中断','低压连接器接触电阻过大','端子额定值、接触正压力和压降预算',3,'9–16V边界、振动后电压降测试',3,['低压连接器']),
    component(16,'L2-LV-02','低压线束','线缆','以规定线径传输KL30电流','限制线缆压降和温升','KL30电流路径损耗过大','低压线缆截面积不足','RMS电流、压降、束径和环境降额',3,'最大负载下压降与温升测试',3,['线缆']),
    component(17,'L2-LV-03','低压线束','低压连接器','传输低压通信和控制信号','保持针脚定义及接触连续性','低压通信或控制信号丢失','低压连接器端子退针','接口矩阵、CPA/TPA和保持力设计',4,'端子保持力、振动和连续性监测',4,['低压连接器']),
    component(18,'L2-LV-04','低压线束','线缆','按KL30拓扑向包内负载配电','将电源送达每个低压负载','包内低压负载失电','低压线缆支路开路','电源分配图、分支截面积和路由防护',3,'逐支路导通、压降和故障注入测试',3,['线缆']),
    component(20,'L2-LV-05','低压线束','低压接线端子','形成低压连接器可拆卸端接','通过压接连接线缆与端子','低压接口间歇开路','低压接线端子压接不良','压接高度、拉脱力和材料匹配窗口',4,'截面分析、拉脱力和毫伏压降测试',3,['低压接线端子']),
    component(20,'L2-LV-06','低压线束','低压连接器','提供完整低压针脚接口','以唯一键位匹配整车连接器','低压接口错接','低压连接器键位防错失效','接口唯一化、键位和颜色防错设计',2,'错插、错针和装配防错验证',2,['低压连接器']),
    component(21,'L2-LV-07','低压线束','低压OT端子','提供独立低阻车身接地路径','通过螺栓搭接连接车身地','车身接地电阻超过0.1Ω','低压OT端子搭接松动','孔径、防转、镀层和紧固扭矩设计',3,'四线法电阻、扭矩保持和盐雾测试',3,['低压OT端子']),
    component(40,'L2-LV-08','低压线束','水温传感器','向控制系统提供冷却液温度','在规定精度和响应时间内感温','冷却液温度信号偏差','水温传感器测量漂移','量程、精度、安装热阻和密封设计',3,'全温标定、响应时间和IP测试',4,['水温传感器']),
    component(40,'L2-LV-09','低压线束','水温传感器','连续提供冷却液温度信号','维持传感器供电和信号回路连续','冷却液温度信号丢失','水温传感器内部开路','传感器端接、引线应变和开路诊断设计',3,'开短路注入、振动和热冲击测试',3,['水温传感器']),

    component(22,'L2-HV-01','高压线束','高压连接器','连接前MCU高压母线','保持低接触电阻和可靠锁止','前MCU高压连接中断','高压连接器端子退针','端子保持力、CPA和接触正压力设计',3,'保持力、振动和动态接触电阻测试',3,['高压连接器']),
    component(22,'L2-HV-02','高压线束','高压线缆','向前MCU传输额定功率','以50mm²导体承载前MCU电流','前MCU高压路径温升超限','高压线缆导体温升超限','RMS电流、线径和环境降额校核',3,'最大负载温升与压降测试',3,['高压线缆']),
    component(23,'L2-HV-03','高压线束','高压连接器','连接后MCU高压母线','保持低接触电阻和可靠锁止','后MCU高压连接中断','高压连接器接触电阻过大','端子材料、镀层和压接窗口设计',3,'温升、压降和振动后接触电阻测试',3,['高压连接器']),
    component(23,'L2-HV-04','高压线束','高压线缆','向后MCU传输额定功率','以50mm²导体承载后MCU电流','后MCU高压路径开路','高压线缆导体断裂','路由、弯曲半径、应变释放和耐磨设计',3,'弯折、振动和导通连续性测试',3,['高压线缆']),
    component(24,'L2-HV-05','高压线束','高压连接器','连接辅助高压支路','以4极接口匹配辅助负载针脚','辅助高压支路错接','高压连接器针脚定义错误','接口矩阵、键位和装配防错设计',2,'错插、错针及端到端导通测试',2,['高压连接器']),
    component(24,'L2-HV-06','高压线束','高压线缆','向辅助高压负载传输功率','以4mm²或6mm²导体承载支路电流','辅助高压线束温升超限','高压线缆截面积不足','支路RMS电流、线径和环境降额校核',3,'最大工况温升与压降测试',3,['高压线缆']),
    component(25,'L2-HV-07','高压线束','高压连接器','连接OBC高压充电接口','在充电工况下保持低阻连接','OBC充电高压连接中断','高压连接器锁止失效','锁止行程、CPA和插拔力设计',3,'充电工况振动、插拔和连续性测试',3,['高压连接器']),
    component(25,'L2-HV-08','高压线束','高压线缆','向OBC传输充电功率','以6mm²导体承载充电电流','OBC高压线束温升超限','高压线缆导体温升超限','充电RMS电流、线径与束径降额校核',3,'持续充电温升与压降测试',3,['高压线缆']),
    component(26,'L2-HV-09','高压线束','高压连接器','支持无需特殊工具插拔维护','通过手动锁止机构完成插拔','高压连接器不可正常拆装','高压连接器锁止机构卡滞','人机工程、操作空间和锁止力设计',3,'实车插拔力、可达性和耐久验证',3,['高压连接器']),
    component(27,'L2-HV-10','高压线束','高压连接器','以RAL2001标识高压接口','外壳保持规定橙色','高压连接器颜色错误','高压连接器外壳色差超限','材料色板、色差限值和防错清单',3,'色差仪与来料目视检验',2,['高压连接器']),
    component(28,'L2-HV-11','高压线束','高压连接器','防止错误方向或位置插合','以唯一键位限制插合方向','高压接口错误插合','高压连接器防错键位失效','键位唯一化和公差链校核',2,'错插、斜插和极限尺寸验证',2,['高压连接器']),
    component(29,'L2-HV-12','高压线束','高压连接器','插合后阻止水尘进入','压紧密封圈形成IP6K9界面','插合状态防护等级不足','高压连接器密封圈压缩不足','密封压缩率、界面公差和材料设计',3,'IP6K9、热循环后泄漏测试',3,['高压连接器']),
    component(30,'L2-HV-13','高压线束','高压连接器','插合及未插合时防止触电','通过护套阻止试指接触端子','高压端子可被触及','高压连接器端子前端防护不足','护套开口、端子位置和退针防护设计',2,'IPxxB试指及退针状态检查',3,['高压连接器']),
    component(31,'L2-HV-14','高压线束','高压连接器','实现HVIL晚接早断时序','以互锁端子长度保证插拔时序','HVIL插拔时序错误','高压连接器互锁端子位置偏差','端子长度、位置和插合行程尺寸链',3,'插拔过程HVIL与功率端子时序测试',3,['高压连接器']),
    component(31,'L2-HV-15','高压线束','互锁低压线缆','传输HVIL连续性信号','连接HVIL IN和HVIL OUT','HVIL信号中断','互锁低压线缆导体开路','导体规格、路由防护和端接应变释放',3,'开短路注入、弯折和振动测试',3,['互锁低压线缆']),
    component(33,'L2-HV-16','高压线束','高压线缆','满足主DC路径Class C温升','在主回路RMS电流下限制导体温升','主DC路径温升超限','高压线缆线径不足','RMS电流、环境温度和成束降额计算',3,'Class C工况温升与热稳态测试',3,['高压线缆']),
    component(34,'L2-HV-17','高压线束','高压线缆','以RAL2001标识高压线束','护套保持规定橙色','高压线束颜色错误','高压线缆护套色差超限','护套材料色板和供应商限度样件',3,'色差仪与来料目视检验',2,['高压线缆']),
    component(10,'L2-HV-18','高压线束','高压线缆','维持高压导体对车身绝缘','护套承受电压、温度和磨损','高压线束绝缘电阻不足','高压线缆护套破损','耐压等级、路由间隙和耐磨防护设计',3,'耐磨、耐压、绝缘电阻和湿热测试',3,['高压线缆']),

    component(1,'L2-BUS-01','汇流排','','低阻传输模组间主回路电流','','汇流排压降或纹波超限','','材料、截面积、长度和搭接界面校核',3,'四线法电阻、压降和温升测试',3,['汇流排']),
    component(10,'L2-BUS-02','汇流排','','保持异电位汇流排及壳体间绝缘','','汇流排对壳绝缘失效','','电气间隙、爬电距离、公差链和固定设计',3,'耐压、绝缘电阻和振动后复测',3,['汇流排']),
    component(42,'L2-BUS-03','汇流排','','向高压接口稳定传输峰值及RMS电流','','汇流排局部温升超限','','电流分布、热点、螺栓搭接与散热校核',3,'热像、温升和扭矩保持测试',3,['汇流排']),
    component(42,'L2-BUS-04','汇流排','','在振动和热循环后保持主回路连续','','汇流排机械断裂导致主回路开路','','热膨胀、模态、固定点和圆角应力分析',3,'振动、热循环和动态导通监测',4,['汇流排']),
    component(8,'L2-FPC-01','FPC','','传输电芯电压采样信号用于过压保护','','电芯过压采样偏低或丢失','','走线阻抗、熔断结构、焊点和诊断设计',4,'过压边界、开短路和全温精度测试',4,['FPC']),
    component(9,'L2-FPC-02','FPC','','传输电芯电压采样信号用于欠压保护','','电芯欠压采样偏高或丢失','','采样回路误差、串扰和连接可靠性设计',4,'欠压边界、串扰和故障注入测试',4,['FPC']),
    component(39,'L2-FPC-03','FPC','','连续传输电芯电压和温度监测信号','','FPC采样信号间歇中断','','弯折半径、铜箔应变、焊点与固定设计',4,'弯折、振动、热循环和导通监测',4,['FPC']),
    component(39,'L2-FPC-04','FPC','','隔离不同电芯采样通道','','相邻采样通道短路或串扰','','线间距、绝缘覆盖、异物和熔断路径设计',3,'通道间耐压、绝缘电阻和短路注入测试',3,['FPC']),
    component(41,'L2-TAB-01','电芯巴片','','低阻连接电芯并均匀分配电流','','电芯连接压降或温升超限','','材料、截面积、分流路径和焊接窗口设计',4,'四线法电阻、温升和电流均衡测试',4,['电芯巴片']),
    component(41,'L2-TAB-04','电芯巴片','','在振动和热循环后保持电芯连接连续','','电芯巴片焊点开路','','焊接能量、表面状态、焊点数量和应变释放设计',4,'焊点拉力、截面、振动和动态导通测试',4,['电芯巴片']),
    component(6,'L2-TAB-02','电芯巴片','','承受保护器件动作前的故障电流','','电芯巴片在保护前熔断','','短时耐受、最小截面和热影响区校核',3,'短时过流、熔断边界和温升测试',3,['电芯巴片']),
    component(10,'L2-TAB-03','电芯巴片','','保持电芯间连接与周边结构绝缘','','电芯巴片对壳或异电位短路','','绝缘覆盖、位置公差和焊渣控制设计',3,'耐压、绝缘电阻和异物检查',3,['电芯巴片']),
  ];

  const electricalFocuses = [
    ['EDM','EDM（电源分配单元）'],['FUSE','保险丝盒'],['LV','低压线束'],['BUS','汇流排'],['HV','高压线束'],['FPC','FPC'],['TAB','电芯巴片'],
  ];
  electricalFocuses.forEach(([key,focus])=>{
    l2.push(component(43,`L2-EI-${key}`,focus,'',`绝缘：500V电压下，${focus}绝缘电阻≥500MΩ`,'',`${focus}绝缘电阻低于500MΩ`,'',`${focus}绝缘材料、间距、污染和装配防护设计`,3,`500V下${focus}绝缘电阻测试`,3,[focus,'绝缘']));
    l2.push(component(44,`L2-DW-${key}`,focus,'',`耐压：2700V电压下，${focus}漏电流≤0.1mA`,'',`${focus}在2700V下漏电流超过0.1mA`,'',`${focus}耐压等级、绝缘材料、边缘和制造缺陷控制`,3,`2700V下${focus}耐压及漏电流测试`,3,[focus,'耐压']));
  });

  const inheritedL3 = l2.filter((parent)=>parent.E).map((parent,index)=>row(3,`L3-${String(index+1).padStart(2,'0')}`,parent.D,parent.E,'',parent.G,parent.H,'',parent.K,parent.J,parent.L,'',`子零件控制：${parent.M}`,parent.N,`子零件验证：${parent.O}`,parent.P,[parent.D,parent.E]));
  const childMap = {
    'EDM（电源分配单元）':['主继电器','预充继电器','预充电阻','霍尔传感器','EDM铜排','转接PCB'],
    '保险丝盒':['Shunt（电流传感器）','Pyro-fuse','辅助回路保险丝','保险丝盒铜排'],
    '低压线束':['低压连接器','线缆','低压接线端子','低压OT端子','水温传感器'],
    '高压线束':['高压连接器','高压线缆','互锁低压线缆'],
  };
  const electricalL3=[];
  Object.entries(childMap).forEach(([focus,children])=>{
    const insulationParent=l2.find((item)=>item.id.startsWith('L2-EI-')&&item.D===focus);
    const withstandParent=l2.find((item)=>item.id.startsWith('L2-DW-')&&item.D===focus);
    children.forEach((child)=>{
      electricalL3.push(row(3,`L3-EI-${electricalL3.length+1}`,insulationParent.D,child,'',insulationParent.G,`绝缘：500V电压下，${child}绝缘电阻≥500MΩ`,'',insulationParent.K,insulationParent.J,`${child}绝缘电阻低于500MΩ`,'',`${child}绝缘材料、间距、清洁度和装配防护设计`,3,`500V下${child}绝缘电阻测试`,3,[focus,child,'绝缘']));
      electricalL3.push(row(3,`L3-DW-${electricalL3.length+1}`,withstandParent.D,child,'',withstandParent.G,`耐压：2700V电压下，${child}漏电流≤0.1mA`,'',withstandParent.K,withstandParent.J,`${child}在2700V下漏电流超过0.1mA`,'',`${child}耐压等级、绝缘材料、边缘和制造缺陷控制`,3,`2700V下${child}耐压及漏电流测试`,3,[focus,child,'耐压']));
    });
  });
  const l3=[...inheritedL3,...electricalL3];

  global.DFMEA_LIBRARY = { version:3, originalSystemCount:37, source:'new_template.xlsx + 电气系统级别需求(1).xlsx', fields:['C','D','E','F','G','H','I','J','K','L','M','N','O','P'], rows:[...system,...l2,...l3] };
})(window);
