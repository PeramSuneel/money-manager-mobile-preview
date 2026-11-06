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
 assert.equal(tooHigh.emi,4166.67);
 assert.equal(M.goldLoan({grams:0,rate:6000,ltv:75,annualRate:12,months:12,fee:0,gst:18,enteredAmount:0}),null);
 assert.equal(M.goldLoan({grams:10,rate:6000,ltv:105,annualRate:12,months:12,fee:0,gst:18,enteredAmount:0}),null);
});
