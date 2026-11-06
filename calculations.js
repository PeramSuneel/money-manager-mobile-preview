(function(root){
'use strict';
const finite=(v)=>{const n=Number(v);return Number.isFinite(n)?n:NaN};
const nonNegative=(v)=>{const n=finite(v);return Number.isFinite(n)&&n>=0?n:NaN};
const round2=(v)=>Math.round((v+Number.EPSILON)*100)/100;
function sumMoney(values){return round2(values.reduce((s,v)=>s+round2(Number(v)||0),0))}
function monthlyEmi(principal,annualRate,months){
 const p=nonNegative(principal),r=nonNegative(annualRate),n=finite(months);
 if(!Number.isFinite(p)||!Number.isFinite(r)||!Number.isInteger(n)||n<1)return null;
 if(p===0)return 0;
 const monthly=r/1200;
 return round2(monthly===0?p/n:p*monthly*Math.pow(1+monthly,n)/(Math.pow(1+monthly,n)-1));
}
function investmentGrams(budget,rate,gst){
 const b=nonNegative(budget),r=nonNegative(rate),g=nonNegative(gst);
 if(!Number.isFinite(b)||!Number.isFinite(r)||!Number.isFinite(g)||b<=0||r<=0)return null;
 const denominator=r*(1+g/100);
 return denominator>0?b/denominator:null;
}
function jewellery(input){
 const rate=nonNegative(input.rate),grams=nonNegative(input.grams),wastage=nonNegative(input.wastage),making=nonNegative(input.making),discount=nonNegative(input.discount),gst=nonNegative(input.gst);
 if([rate,grams,wastage,making,discount,gst].some(x=>!Number.isFinite(x))||discount>100||wastage>100||gst>100)return null;
 const metal=round2(rate*grams),waste=round2(metal*wastage/100);
 const makingCost=round2(input.makingType==='percent'?metal*making/100:making*grams);
 const subtotal=round2(metal+waste+makingCost),discountValue=round2(subtotal*discount/100);
 const taxable=round2(Math.max(0,subtotal-discountValue)),tax=round2(taxable*gst/100);
 return {metal,waste,makingCost,subtotal,discountValue,taxable,tax,total:round2(taxable+tax)};
}
function goldLoan(input){
 const grams=nonNegative(input.grams),rate=nonNegative(input.rate),ltv=nonNegative(input.ltv),annual=nonNegative(input.annualRate),months=finite(input.months),fee=nonNegative(input.fee),gst=nonNegative(input.gst),entered=nonNegative(input.enteredAmount);
 if([grams,rate,ltv,annual,fee,gst].some(x=>!Number.isFinite(x))||!Number.isInteger(months)||months<1||ltv>100||gst>100)return null;
 const goldValue=round2(grams*rate),maxLoan=round2(goldValue*ltv/100),principal=entered>0?entered:maxLoan;
 const emi=monthlyEmi(principal,annual,months);
 if(emi===null)return null;
 const total=round2(emi*months),interest=round2(Math.max(0,total-principal)),feeGst=round2(fee*gst/100);
 return {goldValue,maxLoan,principal,emi,total,interest,fee,feeGst,feeTotal:round2(fee+feeGst),requestedTooHigh:entered>maxLoan};
}
const api={round2,sumMoney,monthlyEmi,investmentGrams,jewellery,goldLoan};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.MoneyMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
