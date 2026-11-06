const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../calculations.js');

test('currency sums avoid binary floating point drift',()=>{
 assert.equal(M.sumMoney([0.1,0.2,0.3]),0.6);
 assert.equal(M.sumMoney([12500.25,7499.75]),20000);
});
test('reducing-balance EMI matches standard amortisation formula',()=>{
 assert.equal(M.monthlyEmi(120000,0,12),10000);
 const emi=M.monthlyEmi(1000000,12,120);
 assert.ok(Math.abs(emi-14347.09)<1.5, 'EMI should be close to independently calculated ₹14,347');
 assert.equal(M.monthlyEmi(100000,10,0),null);
 assert.equal(M.monthlyEmi(-100,10,12),null);
});
test('investment quantity includes GST in the budget',()=>{
 assert.equal(M.investmentGrams(10300,1000,3),10);
 assert.equal(M.investmentGrams(10000,0,3),null);
 assert.equal(M.investmentGrams(10000,1000,-1),null);
 assert.equal(M.investmentGrams(0,1000,3),null);
});
test('jewellery bill applies wastage, making, discount and GST in order',()=>{
 const x=M.jewellery({rate:1000,grams:10,wastage:8,making:500,discount:10,gst:3,makingType:'gram'});
 assert.deepEqual(x,{metal:10000,waste:800,makingCost:5000,subtotal:15800,discountValue:1580,taxable:14220,tax:426.6,total:14646.6});
 const p=M.jewellery({rate:1000,grams:10,wastage:8,making:10,discount:0,gst:3,makingType:'percent'});
 assert.equal(p.makingCost,1000);
 assert.equal(M.jewellery({rate:0,grams:10,wastage:0,making:0,discount:0,gst:3,makingType:'gram'}),null);
 assert.equal(M.jewellery({rate:1000,grams:10,wastage:0,making:0,discount:101,gst:3,makingType:'gram'}),null);
});
test('gold-loan estimate uses monthly reducing-balance EMI and fee GST separately',()=>{
 const x=M.goldLoan({grams:10,rate:6000,ltv:75,annualRate:12,months:12,fee:500,gst:18,enteredAmount:0});
 assert.equal(x.goldValue,60000);
 assert.equal(x.maxLoan,45000);
 assert.equal(x.principal,45000);
 assert.ok(x.emi>3900&&x.emi<4100);
 assert.equal(x.feeGst,90);
 assert.equal(x.feeTotal,590);
 assert.ok(Math.abs(x.total-x.emi*12)<0.01);
 const tooHigh=M.goldLoan({grams:10,rate:6000,ltv:75,annualRate:0,months:12,fee:0,gst:0,enteredAmount:50000});
 assert.equal(tooHigh.requestedTooHigh,true);
 assert.equal(tooHigh.requestedAmount,50000);
 assert.equal(tooHigh.principal,45000);
 assert.equal(tooHigh.emi,3750);
 assert.equal(M.goldLoan({grams:0,rate:6000,ltv:75,annualRate:12,months:12,fee:0,gst:18,enteredAmount:0}),null);
 assert.equal(M.goldLoan({grams:10,rate:6000,ltv:105,annualRate:12,months:12,fee:0,gst:18,enteredAmount:0}),null);
});

test('negative currency rounding is symmetric and safe',()=>{
 assert.equal(M.round2(1.005),1.01);
 assert.equal(M.round2(-1.005),-1.01);
 assert.equal(M.sumMoney([100.10,-0.05,0.05]),100.10);
 assert.equal(Number.isNaN(M.sumMoney([10,Infinity])),true);
});
test('credit-card remaining balance is rounded, partial and never negative',()=>{
 assert.equal(M.remainingBalance(12500,5000),7500);
 assert.equal(M.remainingBalance(100,100),0);
 assert.equal(M.remainingBalance(100,125),0);
 assert.equal(M.remainingBalance(100,-1),null);
});
test('lifetime transaction flow includes income and spending but excludes transfers',()=>{
 assert.equal(M.transactionFlow([{type:'Income',amount:1000.10},{type:'Expense',amount:250.05},{type:'Transfer',amount:500}]),750.05);
 assert.equal(M.transactionFlow([{type:'Income',amount:-5}]),null);
});
test('gold and silver holding values use the matching per-gram rate',()=>{
 const rates={g24:14000,g22:13000,g18:10500,silver:150};
 assert.equal(M.metalValue('Gold','22',10,rates),130000);
 assert.equal(M.metalValue('Silver','999',10,rates),1500);
 assert.equal(M.metalValue('Silver','999',0,rates),null);
 assert.equal(M.metalValue('Gold','21',10,rates),null);
});
test('EMI handles zero interest and rejects non-finite results',()=>{
 assert.equal(M.monthlyEmi(120000,0,12),10000);
 assert.equal(M.monthlyEmi(1000000,100000,1200),null);
});
