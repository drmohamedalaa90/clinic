const CACHE = 'operation-clinic-v29-clean-2026-08-10';

const STATIC = [
  './',
  './index.html',
  './app.html',
  './directions.html',
  './css/style.css',
  './manifest.webmanifest',

  './js/supabase-client.js',
  './js/auth.js',
  './js/core.js',
  './js/dashboard.js',
  './js/schedules.js',
  './js/patients.js',
  './js/appointments.js',
  './js/booking-workflow-hotfix.js',
  './js/clinical.js',
  './js/referrals.js',
  './js/notifications.js',
  './js/push-notifications.js',
  './js/finance.js',
  './js/logistics.js',
  './js/attendance.js',
  './js/admin.js',
  './js/reports.js',
  'js/realtime-sync.js',
  './js/pwa.js',

  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/alaa-clinic-logo.png'
];


self.addEventListener(
  'install',
  event=>{

    event.waitUntil(
      caches
        .open(CACHE)
        .then(
          cache=>
            cache.addAll(STATIC)
        )
        .then(
          ()=>self.skipWaiting()
        )
    );
  }
);


self.addEventListener(
  'activate',
  event=>{

    event.waitUntil(
      caches
        .keys()
        .then(
          keys=>
            Promise.all(
              keys
                .filter(
                  key=>
                    key!==CACHE
                )
                .map(
                  key=>
                    caches.delete(key)
                )
            )
        )
        .then(
          ()=>self.clients.claim()
        )
    );
  }
);


self.addEventListener(
  'fetch',
  event=>{

    const request =
      event.request;


    const url =
      new URL(
        request.url
      );


    if(
      request.method!=='GET'
      ||
      url.hostname.includes(
        'supabase.co'
      )
      ||
      url.hostname.includes(
        'jsdelivr.net'
      )
    ){
      return;
    }


    /*
     * HTML / JS / CSS must prefer the NETWORK and bypass the normal
     * HTTP cache. This prevents phones from staying on yesterday's
     * book.html/app code after a GitHub deployment.
     */
    const isLiveCode =
      request.mode==='navigate'
      ||
      /\.(html|js|css)$/i.test(
        url.pathname
      );


    if(isLiveCode){

      event.respondWith(
        fetch(
          request,
          {
            cache:'no-store'
          }
        )
        .then(
          response=>{

            const copy =
              response.clone();


            caches
              .open(CACHE)
              .then(
                cache=>
                  cache.put(
                    request,
                    copy
                  )
              );


            return response;
          }
        )
        .catch(
          ()=>caches.match(
            request
          )
        )
      );


      return;
    }


    /*
     * Images/icons can still use normal network-first caching.
     */
    event.respondWith(
      fetch(
        request
      )
      .then(
        response=>{

          const copy =
            response.clone();


          caches
            .open(CACHE)
            .then(
              cache=>
                cache.put(
                  request,
                  copy
                )
            );


          return response;
        }
      )
      .catch(
        ()=>caches.match(
          request
        )
      )
    );
  }
);


/* =========================================================
   PUSH — V29: ONE VISIBLE BOOKING ALERT PER DEVICE
========================================================= */

const PUSH_IN_FLIGHT =
  new Set();


const PUSH_DEDUPE_CACHE =
  'clinic-push-dedupe-v29';


const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;


async function dedupeHit(
  key,
  windowMs
){

  const cache =
    await caches.open(
      PUSH_DEDUPE_CACHE
    );


  const request =
    new Request(
      new URL(
        `__push_v29__/${encodeURIComponent(key)}`,
        self.registration.scope
      ).href
    );


  const previous =
    await cache.match(
      request
    );


  const now =
    Date.now();


  if(previous){

    const old =
      Number(
        await previous.text()
      );


    if(
      Number.isFinite(
        old
      )
      &&
      now-old < windowMs
    ){

      return true;
    }
  }


  await cache.put(
    request,
    new Response(
      String(now)
    )
  );


  return false;
}


function appointmentIdFromPayload(
  data
){

  const direct =
    data?.appointmentId
    ||
    data?.appointment_id
    ||
    data?.appointment
    ||
    data?.data?.appointmentId
    ||
    data?.data?.appointment_id
    ||
    data?.data?.appointment
    ||
    null;


  if(direct){
    return String(direct);
  }


  /*
   * Last fallback: if the backend placed the appointment UUID in the URL
   * or another payload field, find it anywhere in the JSON payload.
   */
  try{

    const match =
      JSON
        .stringify(
          data
        )
        .match(
          UUID_RE
        );


    return match?.[0] || null;

  }
  catch{

    return null;
  }
}


self.addEventListener(
  'push',
  event=>{

    let data = {};


    try{

      data =
        event.data
          ? event.data.json()
          : {};

    }
    catch{

      data = {
        title:
          'Clinic notification',

        body:
          event.data?.text()
          ||
          ''
      };
    }


    const appointmentId =
      appointmentIdFromPayload(
        data
      );


    const tag =
      appointmentId
        ? `booking-${appointmentId}`
        : (
            data.tag
            ||
            'clinic-notification'
          );


    const fingerprint =
      appointmentId
        ? `appointment:${appointmentId}`
        : `payload:${data.tag || ''}|${data.title || ''}|${data.body || ''}`;


    if(
      PUSH_IN_FLIGHT.has(
        fingerprint
      )
    ){

      console.info(
        'V29 concurrent duplicate suppressed',
        fingerprint
      );

      return;
    }


    PUSH_IN_FLIGHT.add(
      fingerprint
    );


    event.waitUntil(
      (async()=>{

        try{

          /*
           * Appointment ID known:
           * suppress same appointment for 5 minutes.
           */
          if(
            appointmentId
            &&
            await dedupeHit(
              fingerprint,
              5*60*1000
            )
          ){

            console.info(
              'V29 appointment duplicate suppressed',
              fingerprint
            );

            return;
          }


          /*
           * If old backend payloads contain no appointment ID,
           * suppress a second booking-looking push arriving within 2.5 s.
           * This is specifically a safety net for the iPhone duplicate issue.
           */
          const bookingLike =
            String(
              data.type
              ||
              data.category
              ||
              data.title
              ||
              ''
            )
            .toLowerCase()
            .includes(
              'booking'
            );


          if(
            !appointmentId
            &&
            bookingLike
            &&
            await dedupeHit(
              'booking-fallback-cooldown',
              2500
            )
          ){

            console.info(
              'V29 fallback booking duplicate suppressed'
            );

            return;
          }


          const icon =
            new URL(
              'assets/alaa-clinic-logo.png',
              self.registration.scope
            ).href;


          const existing =
            await self.registration
              .getNotifications({
                tag
              });


          existing.forEach(
            item=>
              item.close()
          );


          await self.registration
            .showNotification(
              data.title
              ||
              'Clinic notification',
              {
                body:
                  data.body
                  ||
                  '',

                icon,
                badge:
                  icon,

                tag,
                renotify:false,

                data:{
                  url:
                    data.url
                    ||
                    'app.html',

                  appointmentId
                }
              }
            );

        }
        finally{

          PUSH_IN_FLIGHT.delete(
            fingerprint
          );
        }
      })()
    );
  }
);


/* =========================================================
   CLICK — EXACTLY ONE LISTENER
========================================================= */

self.addEventListener(
  'notificationclick',
  event=>{

    event.notification.close();


    const targetUrl=
      new URL(
        event.notification
          .data?.url
        ||
        'app.html',
        self.registration.scope
      ).href;


    event.waitUntil(
      clients
        .matchAll({
          type:'window',
          includeUncontrolled:true
        })
        .then(
          async windows=>{

            for(
              const client
              of windows
            ){

              if(
                'navigate'
                in client
              ){

                try{
                  await client.navigate(
                    targetUrl
                  );
                }
                catch(error){
                  console.warn(
                    'Notification navigation failed',
                    error
                  );
                }


                return client.focus();
              }
            }


            return clients.openWindow(
              targetUrl
            );
          }
        )
    );
  }
);
