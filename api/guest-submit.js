import { createClient } from '@supabase/supabase-js';
export const config={api:{bodyParser:false}};
const fields=['name','email','pronunciation','pronouns','organization','role_title','bio','website','offer_url','social_links','product_name','community_impact','revenue_model','origin_story','hard_lesson','surprising_fact','discussion_topics'];
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.RESEND_API_KEY)return res.status(503).json({error:'Guest form is not configured yet'});
 try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>7*1024*1024)return res.status(413).json({error:'Submission exceeds 7 MB'});chunks.push(chunk);}const request=new Request('https://localhost/',{method:'POST',headers:{'content-type':req.headers['content-type']||''},body:Buffer.concat(chunks),duplex:'half'});const form=await request.formData();if(form.get('company_fax'))return res.json({ok:true});
 const row={};for(const key of fields)row[key]=String(form.get(key)||'').trim().slice(0,key==='bio'||key==='discussion_topics'?4000:1500);
 if(!row.name||!row.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)||!row.bio||form.get('permission_headshot')!=='yes')return res.status(400).json({error:'Name, email, bio, and headshot/bio permission are required'});
 for(const key of ['website','offer_url'])if(row[key]&&!/^https?:\/\//.test(row[key]))return res.status(400).json({error:`${key} must be a full URL`});
 row.permission_headshot=true;row.permission_links=form.get('permission_links')==='yes';const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const file=form.get('headshot');
 if(file&&typeof file==='object'&&file.size){if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))return res.status(400).json({error:'Headshot must be JPG, PNG, or WebP under 5 MB'});const path=`${crypto.randomUUID()}.${file.type.split('/')[1].replace('jpeg','jpg')}`;const {error}=await db.storage.from('podcast-headshots').upload(path,Buffer.from(await file.arrayBuffer()),{contentType:file.type});if(error)throw error;row.headshot_path=path;}
 const {data,error}=await db.from('podcast_guest_submissions').insert(row).select('id').single();if(error)throw error;
 const recipient=process.env.GUEST_INBOX||'guest@fromimpacttoincome.com';const sender=process.env.EMAIL_FROM;if(!sender)return res.status(500).json({error:'Saved, but the notification sender is not configured. Contact the podcast team.'});
 const summary=fields.map(k=>`${k.replaceAll('_',' ')}: ${row[k]||'—'}`).join('\n\n')+`\n\nHeadshot: ${row.headshot_path?'Available in admin dashboard':'Not provided'}\nSubmission ID: ${data.id}`;
 const email=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:sender,to:[recipient],subject:`Podcast guest intake: ${row.name}`,text:summary,reply_to:row.email})});if(!email.ok){console.error('Guest notification failed',email.status,await email.text());return res.status(502).json({error:'Details were saved, but email notification failed. Please contact the podcast team.'});}
 return res.json({ok:true});}catch(e){console.error('Guest intake failed',e);return res.status(500).json({error:'Could not submit guest details. Please try again.'});}
}
