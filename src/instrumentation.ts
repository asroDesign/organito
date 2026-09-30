export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs' && process.env.NEXT_PHASE!=='phase-production-build'){
  const {processCampaigns}=await import('./lib/crm');
  const state=globalThis as typeof globalThis & {organoCampaignTimer?:ReturnType<typeof setInterval>};
  if(!state.organoCampaignTimer){
   state.organoCampaignTimer=setInterval(()=>{void processCampaigns().catch(e=>console.error('Campaign worker failed:',e instanceof Error?e.name:'unknown'))},60000);
   state.organoCampaignTimer.unref?.();
  }
 }
}
