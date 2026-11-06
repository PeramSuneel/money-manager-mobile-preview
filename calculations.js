(function(root){
'use strict';
const finite=v=>{const n=Number(v);return Number.isFinite(n)?n:NaN};
const nonNegative=v=>{const n=finite(v);return Number.isFinite(n)&&n>=0?n:NaN};
function toCents(value){
 const n=finite(value);
 if(!Number.isFinite(n)||Math.abs(n)>Number.MAX_SAFE_INTEGER/100)return null;
 return (n<0?-1:1)*Math.round((Math.abs(n)+Number.EPSILON)*100);
}
function round2(value){const cents=toCents(value);return cents===null?NaN:cents/100}
function sumMoney(values){
 if(!Array.isArray(values))return NaN;
 let cents=0;
 for(const value of values){const part=toCents(value);if(part===null)return NaN;cents+=part;if(!Number.isSafeInteger(cents))return NaN}
 return cents/100;
}
function remainingBalance(total,paid){
 const bill=nonNegative(total),settled=nonNegative(paid);
 if(!Number.isFinite(bill)||!Number.isFinite(settled))return null;
 return Math.max(0,round2(bill-settled));
}
function transactionFlow(transactions){
 if(!Array.isArray(transactions))return null;
 const values=[];
 for(const item of transactions){
  if(item?.type!=='Income'&&item?.type!=='Expense')continue;
  const amount=nonNegative(item.amount);
  if(!Number.isFinite(amount))return null;
  values.push(item.type==='Income'?amount:-amount);
 }
 const total=sumMoney(values);
 return Number.isFinite(total)?total:null;
}
function metalValue(metal,purity,grams,rates){
 const weight=nonNegative(grams);
 if(!Number.isFinite(weight)||weight<=0||!rates)return null;
 const kind=String(metal||'Gold').toLowerCase();
 const rate=kind==='silver'?nonNegative(rates.silver):nonNegative(rates['g'+String(purity)]);
 if(!Number.isFinite(rate)||rate<=0)return null;
 return round2(weight*rate);
}
function monthlyEmi(principal,annualRate,months){
 const p=nonNegative(principal),r=nonNegative(annualRate),n=finite(months);
 if(!Number.isFinite(p)||!Number.isFinite(r)||!Number.isInteger(n)||n<1)return null;
 if(p===0)return 0;
 const monthly=r/1200;
 if(monthly===0)return round2(p/n);
 const factor=Math.pow(1+monthly,n);
 if(!Number.isFinite(factor))return null;
 const value=p*monthly*factor/(factor-1);
 return Number.isFinite(value)?round2(value):null;
}
function investmentGrams(budget,rate,gst){
 const b=nonNegative(budget),r=nonNegative(rate),g=nonNegative(gst);
 if(!Number.isFinite(b)||!Number.isFinite(r)||!Number.isFinite(g)||b<=0||r<=0)return null;
 const denominator=r*(1+g/100);
 return denominator>0?b/denominator:null;
}
function jewellery(input){
 if(!input||typeof input!=='object')return null;
 const rate=nonNegative(input.rate),grams=nonNegative(input.grams),wastage=nonNegative(input.wastage),making=nonNegative(input.making),discount=nonNegative(input.discount),gst=nonNegative(input.gst);
 if([rate,grams,wastage,making,discount,gst].some(x=>!Number.isFinite(x))||rate<=0||grams<=0||discount>100||wastage>100||gst>100)return null;
 const metal=round2(rate*grams),waste=round2(metal*wastage/100);
 const makingCost=round2(input.makingType==='percent'?metal*making/100:making*grams);
 const subtotal=round2(metal+waste+makingCost),discountValue=round2(subtotal*discount/100);
 const taxable=round2(Math.max(0,subtotal-discountValue)),tax=round2(taxable*gst/100);
 return {metal,waste,makingCost,subtotal,discountValue,taxable,tax,total:round2(taxable+tax)};
}
function goldLoan(input){
 if(!input||typeof input!=='object')return null;
 const grams=nonNegative(input.grams),rate=nonNegative(input.rate),ltv=nonNegative(input.ltv),annual=nonNegative(input.annualRate),months=finite(input.months),fee=nonNegative(input.fee),gst=nonNegative(input.gst),entered=nonNegative(input.enteredAmount);
 if([grams,rate,ltv,annual,fee,gst].some(x=>!Number.isFinite(x))||grams<=0||rate<=0||ltv<=0||!Number.isInteger(months)||months<1||ltv>100||gst>100)return null;
 const goldValue=round2(grams*rate),maxLoan=round2(goldValue*ltv/100),principal=entered>0?entered:maxLoan;
 const emi=monthlyEmi(principal,annual,months);
 if(emi===null)return null;
 const total=round2(emi*months),interest=round2(Math.max(0,total-principal)),feeGst=round2(fee*gst/100);
 return {goldValue,maxLoan,principal,emi,total,interest,fee,feeGst,feeTotal:round2(fee+feeGst),requestedTooHigh:entered>maxLoan};
}
const api={round2,sumMoney,remainingBalance,transactionFlow,metalValue,monthlyEmi,investmentGrams,jewellery,goldLoan};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.MoneyMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
