import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL!})});
const day=(n:number)=>new Date(new Date().toISOString().slice(0,10)+'T00:00:00Z').getTime()+n*86400000;
async function main(){
  await db.supplier.upsert({where:{id:'demo-travel'},create:{id:'demo-travel',name:'BERJIS Sandbox',mode:'DEMO'},update:{}});
  const offers:Prisma.OfferCreateManyInput[]=[];
  const routes=[['تهران','کیش','THR','KIH'],['تهران','مشهد','THR','MHD'],['تهران','استانبول','IKA','IST'],['تهران','دبی','IKA','DXB'],['تهران','شیراز','THR','SYZ'],['شیراز','کیش','SYZ','KIH']];
  for(const [from,to,fromCode,toCode] of [...routes,...routes.map(([a,b,c,d])=>[b,a,d,c])]) for(let a=0;a<3;a++) {
    offers.push({id:`flight-${fromCode}-${toCode}-${a}`,supplierId:'demo-travel',product:'FLIGHT',title:['ماهان','ایران‌ایر','کیش‌ایر'][a],subtitle:`پرواز مستقیم ${from} به ${to}`,origin:from,destination:to,priceIrr:18_500_000+a*4_200_000+(toCode==='IST'||toCode==='DXB'?85_000_000:0),image:'/images/kish.jpg',details:{airline:['ماهان','ایران‌ایر','کیش‌ایر'][a],flightNumber:`DEMO-${a+100}`,departure:['07:30','12:45','19:20'][a],arrival:['09:10','14:25','21:00'][a],duration:'۱ ساعت و ۴۰ دقیقه',stops:0,baggage:'۲۰ کیلوگرم',cabin:'اکونومی',fromCode,toCode,international:['IST','DXB'].includes(toCode)||['IST','DXB'].includes(fromCode),rules:'آزمایشی: تا پیش از تأیید تأمین‌کننده، رزرو قطعی نیست. درخواست کنسلی پس از صدور به بررسی نیاز دارد.'}});
  }
  const hotels=[
    ['hotel-toranj','هتل ترنج کیش','کیش','اقامت روی آب‌های خلیج فارس',78_000_000,'/images/kish.jpg',5,['ساحل اختصاصی','صبحانه','استخر','اینترنت'],26.562,53.984],
    ['hotel-dariush','هتل داریوش کیش','کیش','شکوه پارسی، آرامش جزیره',65_000_000,'/images/hotel.jpg',5,['صبحانه','استخر','اسپا','اینترنت'],26.548,54.037],
    ['hotel-istanbul','هتل پرا استانبول','استانبول','روایت یک اقامت در قلب استانبول',94_000_000,'/images/istanbul.jpg',5,['صبحانه','اسپا','اینترنت'],41.031,28.975],
    ['hotel-shiraz','هتل زندیه شیراز','شیراز','در همسایگی تاریخ و عطر بهارنارنج',48_000_000,'/images/shiraz.jpg',5,['صبحانه','استخر','پارکینگ'],29.619,52.544]
  ] as const;
  for(const [id,title,destination,subtitle,priceIrr,image,stars,amenities,lat,lng] of hotels) offers.push({id,supplierId:'demo-travel',product:'HOTEL',title,subtitle,destination,priceIrr,image,details:{stars,amenities:[...amenities],lat,lng,roomType:'اتاق دوتخته استاندارد',maxGuestsPerRoom:2,checkIn:'۱۴:۰۰',checkOut:'۱۲:۰۰',rules:'نرخ آزمایشی به ازای اتاق در هر شب است. درخواست لغو نیازمند بررسی است. رزرو فقط پس از صدور واچر آزمایشی تأیید می‌شود.'}});
  const tours=[
    ['tour-istanbul','استانبول، تلاقی دو جهان','استانبول','در کوچه‌های تاریخ، کنار آبی بسفر',245_000_000,'/images/istanbul.jpg','۵ شب و ۶ روز','هوایی',false],
    ['tour-kish','کیش، به رنگ آرامش','کیش','چند روز دور از روزمرگی، نزدیک به دریا',128_000_000,'/images/kish.jpg','۳ شب و ۴ روز','هوایی',false],
    ['tour-shiraz','شیراز، شعر ناتمام','شیراز','از باغ ارم تا قصه‌های تخت جمشید',89_000_000,'/images/shiraz.jpg','۳ شب و ۴ روز','زمینی',true],
    ['tour-dubai','دبی، تجربه‌ای فراتر','دبی','چشم‌اندازهای فردا در ساحل خلیج فارس',365_000_000,'/images/dubai.jpg','۴ شب و ۵ روز','هوایی',false]
  ] as const;
  for(const [id,title,destination,subtitle,priceIrr,image,duration,transport,manualConfirmation] of tours) offers.push({id,supplierId:'demo-travel',product:'TOUR',title,subtitle,destination,priceIrr,image,details:{duration,transport,manualConfirmation,services:['رفت‌وبرگشت','اقامت با صبحانه','راهنمای فارسی‌زبان','بیمه مسافرتی'],itinerary:['ورود، استقبال و انتقال به هتل','گشت شهری با راهنمای محلی و زمان آزاد','تجربه‌های محلی و بازدید از دیدنی‌ها','وقت آزاد و بازگشت'],documents:'مدرک شناسایی معتبر؛ برای سفر خارجی گذرنامه با اعتبار کافی و ویزای لازم.',rules:'اطلاعات، قیمت و ظرفیت همگی DEMO هستند. شرایط کنسلی پیش از تأیید نهایی بررسی می‌شود.'}});
  await db.offer.createMany({data:offers,skipDuplicates:true});
  await db.inventory.createMany({data:offers.flatMap(o=>Array.from({length:60},(_,i)=>({offerId:o.id!,date:new Date(day(i)),total:o.product==='FLIGHT'?18:o.product==='HOTEL'?8:12,available:o.product==='FLIGHT'?18:o.product==='HOTEL'?8:12}))),skipDuplicates:true});
  await db.article.createMany({data:[
    {id:'istanbul-guide',title:'استانبول را جور دیگری ببینید',excerpt:'یک راهنمای کوچک برای کشف کوچه‌ها، کافه‌ها و قصه‌های شهر دو قاره.',body:'صبح را در محله بالات آغاز کنید. از کنار خانه‌های رنگی به سوی اسکله بروید و با کشتی به بخش آسیایی شهر سفر کنید. برای بازدید از بناهای تاریخی، ساعت‌های خلوت صبح انتخاب بهتری هستند. پیش از سفر، قوانین ورود و اعتبار مدارک خود را از مراجع رسمی بررسی کنید.',image:'/images/istanbul.jpg'},
    {id:'kish-guide',title:'فصل تازه‌ای از آرامش در کیش',excerpt:'از قدم‌زدن کنار ساحل تا تماشای غروب در خلیج فارس.',body:'کیش برای چند روز استراحت و تجربه دریا مقصد مناسبی است. در فصل‌های خنک، مسیرهای دوچرخه‌سواری و ساحل‌گردی دلپذیرترند. آب آشامیدنی، کرم ضدآفتاب و کلاه همراه داشته باشید. خدمات تفریحی را تنها از مراکز مجاز رزرو کنید.',image:'/images/kish.jpg'},
    {id:'travel-checklist',title:'چمدان سبک، خیال آسوده',excerpt:'چک‌لیست کوتاهی که پیش از هر سفر به کارتان می‌آید.',body:'مدارک شناسایی، بیمه، داروهای ضروری، شارژر و نسخه آفلاین اطلاعات رزرو را آماده کنید. نام مسافران باید دقیقاً با مدرک سفر یکسان باشد. قوانین بار، استرداد و ورود به مقصد را پیش از خرید مطالعه کنید.',image:'/images/shiraz.jpg'}
  ],skipDuplicates:true});
  console.log(`Seeded demo catalog (${offers.length} products), inventory and articles; existing data preserved.`);
}
main().finally(()=>db.$disconnect());
