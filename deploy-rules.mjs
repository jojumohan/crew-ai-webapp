import { createSign } from 'crypto';
import { readFileSync } from 'fs';

const PROJECT_ID   = 'meetingaron-55180';
const CLIENT_EMAIL = 'firebase-adminsdk-fbsvc@meetingaron-55180.iam.gserviceaccount.com';
const PRIVATE_KEY  = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDFqMTJtGtF/2MV
fSK/AonWlCa7aNHTUMqiIo+ijECrljIa3yFO7I/p1H78JmbsvQ1fFd3HljG/mW1T
u3BNV1O0VlRA87oRuw6VDkp2Uz39caxAqlFuDjiejgGuVzbZkkD/FyHdIeTg4jgp
nxh51j46t2ympq00A1+EYdDy4EkAly1RNUD8lzb3GWwt6W9iHJOyMrUUnGZPO3+R
acU/cplfnUuJTIq1D3oAHHipQBqdPK7iWMY38Eihx4nrTPjWqNCf2TXMJDt6epcL
20G7r/qfttp+sMnfqrM2BHi51v0XOulcVUefFsSPS6FCQfnrnM1bEGpV4N3oUBYj
IxamoJcHAgMBAAECggEAEArmd0qN9F9J5E9vl6+LOXUf1FEpypbBmOQ+N96zTFnt
6ibBtigBduSOLpqn+un4i7GjelSzPU5Pbx7aUA9Y61z1t1SGKHSVYT1eMiQHzCoY
Os1iu5CAQZoxV7xGEZBLId53m1I/beMz1L5QHGoU9etiRapnNL6wrMwgSz4vSVKs
iDUQZfpfh1vt11EYRdkG4tG5cw8pd/qCpL8QNlY+nTkdf4TAbJbM3KZFljdQlx3Z
s/TkWw2vpTBd+Rp336ZSjam4+s+01xTTcMzsnQiAeBq+/7zJUjbwHhWY5aoisfFp
QtfFZq6SU+4Z++j5cTgYU15xxMtLXvFG21a4A4qONQKBgQDz0i/wsv0tni/yjmz1
IzRRUIPUU0Ilm/sP+QgAVjcrY67ccnYHkfxFA2doSoFcGy4zS0VgYfSZ4pEPU8GW
P9H2MCqrkxdsKgvjb7fB+TtO2tRp5H9IiXrrED49Oa+t5QRhWRsGB+2HQTYSuo5W
9p9ASw7nL5otkS6WbRB6eXOl+wKBgQDPiEv564nv+xSvK191y/KQPmh6YbmmFz0B
RA9cOtOzUFYpsME5+Wz1sYRjJotmrZM0N8MU2vp4R74s8GpUlhugTnnyBFVEWvLJ
kv4sCxM6X/ErhgvRfEqa6hHHKbr9BahV9qYK9alSvvKIJxAhG1aoVjIEvw4O+Ovp
AFiqz5RhZQKBgH5Jmw0oGFy9d4ZB4QujnWCUvIOIUFWckhC24z8RaOfvbM2/94R6
R9kTJ0dsd85WQbrNvPRsKD5gjNQMhNOm4MCMOD3AJTygFqJJ5jrxNZflXmousQLI
OsNwGVyq+WSvn3Iwrf+UsaIB09klib5fZSLu/ZwfGtOJREEj4oodSBprAoGAVZj6
9VcQKrpd2q5CDl0TbClBgJDEONxG3jnLOBhPbxtInqN330igh2ozl42zW6NmHtiN
DxIO0wOMTg7PXJoZRPJ5W7grzyjQERIe4d2jjaU63N/KChqAzwqSUJpGtMvblbFI
5SZUM3vsnvm1rmIPSRlcQhbnXoePDiiFadZ6df0CgYEAsLeR8pO2YCIV3Jts0qkl
Q9ZLTLOmuyAQbpTz5fDFbeWgWk1R5Mt4aqgNoblu6xE8DzxYTt6K2f4RFtOn7Rpy
b44k+p4qQr7KnBfk7gp23v0qrSJzNrjRJbzZo1V/5v3LoPh6BMyx87ULBk/JHmBX
5OM+UMpDKsec/PY/XG0RnuY=
-----END PRIVATE KEY-----`;

const RULES = readFileSync('./firestore.rules', 'utf8');

function base64url(s) {
  return Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function makeJWT() {
  const now = Math.floor(Date.now()/1000);
  const h = base64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const p = base64url(JSON.stringify({iss:CLIENT_EMAIL,sub:CLIENT_EMAIL,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600,scope:'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform'}));
  const sign = createSign('RSA-SHA256'); sign.update(`${h}.${p}`);
  return `${h}.${p}.${sign.sign(PRIVATE_KEY,'base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')}`;
}
async function getToken() {
  const r = await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${makeJWT()}`});
  const d = await r.json(); if(!d.access_token) throw new Error(JSON.stringify(d)); return d.access_token;
}

const token = await getToken();
const rsRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/rulesets`,{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({source:{files:[{name:'firestore.rules',content:RULES}]}})
});
const rs = await rsRes.json();
if(!rs.name) throw new Error('Ruleset failed: '+JSON.stringify(rs));
console.log('Ruleset:', rs.name);

const relRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases/cloud.firestore`,{
  method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({release:{name:`projects/${PROJECT_ID}/releases/cloud.firestore`,rulesetName:rs.name}})
});
console.log('Rules deployed:', (await relRes.json()).rulesetName ? 'OK' : 'check response');
