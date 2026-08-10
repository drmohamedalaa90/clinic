const CACHE = 'operation-clinic-v26-push-hard-dedupe-2026-08-10';

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

    const url=
      new URL(
        event.request.url
      );


    if(
      event.request.method!=='GET'
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


    event.respondWith(

      fetch(
        event.request
      )
      .then(
        response=>{

          const copy=
            response.clone();


          caches
            .open(CACHE)
            .then(
              cache=>
                cache.put(
                  event.request,
                  copy
                )
            );


          return response;
        }
      )
      .catch(
        ()=>caches
          .match(
            event.request
          )
          .then(
            response=>
              response
              ||
              caches.match(
                './index.html'
              )
          )
      )
    );
  }
);


/* =========================================================
   PUSH — EXACTLY ONE LISTENER + HARD DE-DUPLICATION
========================================================= */

const PUSH_DEDUPE_CACHE =
  'clinic-push-dedupe-v1';

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


    event.waitUntil(
      (async()=>{

        /*
         * HARD de-duplication:
         * if iOS/WebKit delivers the same push event twice within
         * two minutes, the second event is ignored completely.
         * This prevents a second banner/sound.
         */
        if(
          await wasPushRecentlyShown(
            tag
          )
        ){

          console.info(
            'Duplicate push suppressed:',
            tag
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
