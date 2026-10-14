const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePath = path.join(__dirname,'..','js','dvpr-merge.js');
const merger = fs.existsSync(modulePath) ? require(modulePath) : null;
assert.ok(merger, 'shared DVP merger is available');
const row = (item,standard,extra={}) => ({id:standard,productId:'fpc',productName:'FPC',testItem:item,
  standard,clause:'按受控方法',sampleQty:'3',environment:'按项目条件',preMeasure:'初始电阻',
  procedure:'规定方法',postMeasure:'最终电阻',acceptance:'按图纸限值',status:'未开始',
  sourceKey:`fpc|${standard}|${item}`,attachments:[],...extra});
const input = [row('盐雾试验','内部数据库',{sampleQty:'5',acceptance:'无腐蚀导致的开路'}),
  row('耐盐雾要求','ISO 9227:2022',{procedure:'采用NSS方法'}),
  row('盐雾试验','内部数据库',{sampleQty:'5',acceptance:'无腐蚀导致的开路'})];
const before = JSON.stringify(input);
let result=merger.mergeRows(input);
assert.equal(result.rows.length,1,'same and synonymous test topics merge');
assert.equal(result.mergedCount,2);
assert.match(result.rows[0].standard,/内部数据库/);
assert.match(result.rows[0].standard,/ISO 9227/);
assert.match(result.rows[0].procedure,/NSS/);
assert.match(result.rows[0].acceptance,/无腐蚀导致的开路/);
assert.match(result.rows[0].sampleQty,/5/);
assert.match(result.rows[0].sampleQty,/3/);
assert.equal(JSON.stringify(input),before,'does not mutate caller data');
assert.deepEqual(merger.mergeRows(result.rows).rows,result.rows,'merging is idempotent');
result=merger.mergeRows([...result.rows,row('耐盐雾要求','ISO 9227:2022',{procedure:'采用NSS方法'})]);
assert.equal(result.rows.length,1,'re-generation does not reintroduce duplicate sources');
assert.deepEqual(result.rows[0],merger.mergeRows(input).rows[0],'re-generation does not grow merged text');

assert.equal(merger.mergeRows([row('低温存储','A'),row('高温存储','B')]).rows.length,2);
assert.equal(merger.mergeRows([row('稳态湿热','A'),row('湿热循环测试','B')]).rows.length,2);
assert.equal(merger.mergeRows([row('保险丝过流','A',{environment:'施加 20 A，持续 10 s'}),row('保险丝过流','B',{environment:'施加 40 A，持续 2 s'})]).rows.length,2,'different load conditions survive');
assert.equal(merger.mergeRows([row('耐电压','A',{environment:'500 V DC'}),row('耐电压测试','B',{environment:'1000 V DC'})]).rows.length,2);
assert.equal(merger.mergeRows([row('高温存储','A',{environment:'85±5 ℃'}),row('高温存储','B',{environment:'105±5 ℃'})]).rows.length,2,'different nominal temperatures are distinct despite equal tolerance');
assert.equal(merger.mergeRows([row('盐雾试验','A'),row('盐雾试验','B',{productId:'pcb'})]).rows.length,2,'never merges different products');
assert.equal(merger.mergeRows([row('气密性测试（单件）','A'),row('气密性测试（总成）','B')]).rows.length,2);
assert.equal(merger.mergeRows([row('插拔寿命1—整车工况','A'),row('插拔寿命2—换电站工况','B')]).rows.length,2);
assert.equal(merger.mergeRows([row('拉伸强度','A'),row('老化后拉伸强度','B')]).rows.length,2);
assert.equal(merger.mergeRows([row('盐雾试验','A',{status:'通过'}),row('盐雾试验','B')]).rows.length,2,'different execution status is not hidden');
assert.equal(merger.mergeRows([row('盐雾试验','A',{owner:'甲'}),row('盐雾试验','B',{owner:'乙'})]).rows.length,2);
const evidence={name:'report.txt',dataUrl:'data:text/plain;base64,YQ==',type:'text/plain',size:1};
result=merger.mergeRows([row('绝缘电阻','A',{attachments:[evidence],owner:'工程师'}),row('绝缘要求','B',{attachments:[evidence]})]);
assert.equal(result.rows.length,1);
assert.equal(result.rows[0].attachments.length,1);
assert.equal(result.rows[0].owner,'工程师');
assert.equal(merger.mergeRows([row('自定义检查 A','A'),row('自定义检查 B','B')]).rows.length,2,'unknown topics are not fuzzy-deleted');
const edited=merger.mergeRows(input).rows[0];
edited.acceptance='人工修订：批准的图纸限值';
result=merger.mergeRows([edited,input[0]]);
assert.equal(result.rows.length,1);
assert.equal(result.rows[0].acceptance,'人工修订：批准的图纸限值','consolidation never restores stale source text over user edits');
result=merger.mergeRows([merger.mergeRows(input).rows[0],edited]);
assert.equal(result.rows[0].acceptance,'人工修订：批准的图纸限值','edited source text survives even when the edited duplicate comes second');
console.log('PASS DVP semantic merge, provenance, distinct conditions, evidence preservation and idempotence');
