const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.order.findFirst({include:{items:true}}).then(o => {
  console.log('Keys:', Object.keys(o));
  console.log('createdAt:', o.createdAt);
  console.log('created_at:', o.created_at);
  console.log('deliveredAt:', o.deliveredAt);
  console.log('delivered_at:', o.delivered_at);
  return p.$disconnect();
}).catch(e => { console.log(e.message); p.$disconnect(); });
