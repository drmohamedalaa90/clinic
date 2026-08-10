const CACHE = 'operation-clinic-v27-final-recovery-2026-08-10';

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
   PUSH — EXACTLY ONE LISTENER + HARD DE-DUPLICATION
========================================================= */

/*
 * Synchronous guard is important:
 * two push events can arrive almost simultaneously before an async cache
 * write finishes. This Set blocks the second one immediately.
 */
const PUSH_IN_FLIGHT =
  new Set();


const PUSH_DEDUPE_CACHE =
  'clinic-push-dedupe-v2';

const PUSH_DEDUPE_WINDOW_MS =
  2 * 60 * 1000;


async function wasPushRecentlyShown(
  tag
){

  const cache =
    await caches.open(
      PUSH_DEDUPE_CACHE
    );


  const key =
    new Request(
      new URL(
        `__push_dedupe__/${encodeURIComponent(tag)}`,
        self.registration.scope
      ).href
    );


  const previous =
    await cache.match(
      key
    );


  const now =
    Date.now();


  if(previous){

    const previousTime =
      Number(
        await previous.text()
      );


    if(
      Number.isFinite(
        previousTime
      )
      &&
      now - previousTime
        < PUSH_DEDUPE_WINDOW_MS
    ){

      return true;
    }
  }


  await cache.put(
    key,
    new Response(
      String(now),
      {
        headers:{
          'Content-Type':
            'text/plain'
        }
      }
    )
  );


  return false;
}


self.addEventListener(
  'push',
  event=>{

    let data={};


    try{

      data=
        event.data
          ? event.data.json()
          : {};

    }
    catch{

      data={
        title:
          'Clinic notification',

        body:
          event.data?.text()
          ||
          ''
      };
    }


    const icon=
      new URL(
        'assets/alaa-clinic-logo.png',
        self.registration.scope
      ).href;


    const tag=
      data.tag
      ||
      (
        data.appointmentId
          ? `booking-${data.appointmentId}`
          : 'clinic-notification'
      );


    /*
     * Fingerprint is independent of the server-provided tag.
     * If two payloads for the same booking have different tags, they still
     * collapse to one visible notification.
     */
    const fingerprint =
      data.appointmentId
        ? `appointment:${data.appointmentId}:${data.title || ''}:${data.body || ''}`
        : `${data.title || ''}|${data.body || ''}|${data.url || ''}`;


    if(
      PUSH_IN_FLIGHT.has(
        fingerprint
      )
    ){

      console.info(
        'Concurrent duplicate push suppressed:',
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

          if(
            await wasPushRecentlyShown(
              fingerprint
            )
          ){

            console.info(
              'Recent duplicate push suppressed:',
              fingerprint
            );

            return;
          }


        /*
         * Defensive cleanup in case an older notification with the
         * same tag is still visible.
         */
        const existing=
          await self.registration
            .getNotifications({
              tag
            });


        existing.forEach(
          notification=>
            notification.close()
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

              renotify:
                false,

              data:{
                url:
                  data.url
                  ||
                  'app.html',

                appointmentId:
                  data.appointmentId
                  ||
                  null
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
