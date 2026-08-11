(() => {

  const C =
    window.Clinic;


  if(!C){
    return;
  }


  function esc(value){
    return C.escape(value ?? '');
  }


  function nameOf(row){

    return (
      C.localizedPersonName?.(
        row
      )
      ||
      row?.display_name
      ||
      row?.username
      ||
      row?.email
      ||
      'User'
    );
  }


  async function participants(){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'clinic_chat_participants'
      );


    if(error){
      throw error;
    }


    return data || [];
  }


  async function getThreads(){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v35_chat_threads'
      );


    if(error){
      throw error;
    }


    return data || [];
  }


  async function getMessages(threadId){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v35_chat_thread_messages',
        {
          p_thread:
            threadId
        }
      );


    if(error){
      throw error;
    }


    return data || [];
  }


  async function getOrCreateThread(otherId){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v35_get_or_create_chat_thread',
        {
          p_other:
            otherId
        }
      );


    if(error){
      throw error;
    }


    return data;
  }


  async function sendMessage(
    recipientId,
    body
  ){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'clinic_send_chat_message',
        {
          p_recipient:
            recipientId,

          p_body:
            body
        }
      );


    if(error){
      throw error;
    }


    const messageId =
      Array.isArray(data)
        ? data[0]
        : data;


    if(messageId){

      C.sb.functions.invoke(
        'send-chat-push',
        {
          body:{
            message_id:
              messageId
          }
        }
      )
      .catch(
        error=>
          console.warn(
            'Chat push failed',
            error
          )
      );
    }


    return messageId;
  }


  let timer =
    null;


  function stopTimer(){

    clearInterval(timer);

    timer =
      null;
  }


  /*
   * CONVERSATION LIST ONLY.
   * Clicking a conversation leaves this page and opens a dedicated page.
   */
  window.ClinicPages[
    'clinic-chat'
  ] =
    async function(){

      stopTimer();


      C.setTitle(
        C.lang==='ar'
          ? 'المحادثات'
          : 'Messages'
      );


      const main =
        document.getElementById(
          'mainContent'
        );


      let people;
      let threads;


      try{

        [
          people,
          threads
        ] =
          await Promise.all([
            participants(),
            getThreads()
          ]);

      }
      catch(error){

        main.innerHTML = `
          <section class="content-card empty-state">
            ${esc(error.message)}
          </section>
        `;

        return;
      }


      const peopleMap =
        new Map(
          people.map(
            p=>[
              p.id,
              p
            ]
          )
        );


      const ownerAudit =
        C.hasRole?.('owner')
        &&
        !C.isDoctor?.()
        &&
        !C.hasRole?.('secretary');


      if(ownerAudit){

        main.innerHTML = `
          <section class="page-toolbar">
            <div>
              <span class="eyebrow">
                OWNER AUDIT
              </span>

              <h2>
                ${
                  C.lang==='ar'
                    ? 'المحادثات'
                    : 'Messages'
                }
              </h2>

              <p class="muted">
                ${
                  C.lang==='ar'
                    ? 'كل محادثة تفتح في صفحة مستقلة.'
                    : 'Every conversation opens as a separate thread page.'
                }
              </p>
            </div>
          </section>

          <section class="v36-message-list content-card">

            ${
              threads.length
                ? threads.map(
                    thread=>`
                      <button
                        type="button"
                        class="v36-message-row"
                        data-audit-thread="${thread.thread_id}"
                      >
                        <div class="v36-message-avatar">
                          💬
                        </div>

                        <div class="v36-message-row-main">
                          <strong>
                            ${esc(
                              thread.thread_label
                              ||
                              'Conversation'
                            )}
                          </strong>

                          <p>
                            ${esc(
                              thread.last_message
                              ||
                              ''
                            )}
                          </p>
                        </div>

                        <small>
                          ${
                            thread.last_message_at
                              ? C.formatDate(
                                  thread.last_message_at,
                                  {
                                    hour:'2-digit',
                                    minute:'2-digit'
                                  }
                                )
                              : ''
                          }
                        </small>
                      </button>
                    `
                  ).join('')
                : `
                    <div class="empty-state">
                      ${
                        C.lang==='ar'
                          ? 'لا توجد محادثات.'
                          : 'No conversations yet.'
                      }
                    </div>
                  `
            }

          </section>
        `;


        main
          .querySelectorAll(
            '[data-audit-thread]'
          )
          .forEach(
            button=>{

              button.onclick =
                ()=>C.route(
                  'clinic-chat-thread',
                  {
                    threadId:
                      button.dataset
                        .auditThread,

                    audit:
                      true
                  }
                );
            }
          );


        return;
      }


      const threadByOther =
        new Map();


      threads.forEach(
        thread=>{

          if(thread.other_user_id){

            threadByOther.set(
              thread.other_user_id,
              thread
            );
          }
        }
      );


      const contacts =
        people.filter(
          p=>
            p.id !==
            C.user.id
        );


      main.innerHTML = `
        <section class="page-toolbar">

          <div>
            <span class="eyebrow">
              MESSAGES
            </span>

            <h2>
              ${
                C.lang==='ar'
                  ? 'المحادثات'
                  : 'Messages'
              }
            </h2>

            <p class="muted">
              ${
                C.lang==='ar'
                  ? 'اختر الشخص لفتح محادثته في صفحة مستقلة مثل Messenger.'
                  : 'Choose a person to open a dedicated Messenger-style thread.'
              }
            </p>
          </div>

        </section>


        <section class="v36-message-list content-card">

          ${contacts.map(
            contact=>{

              const thread =
                threadByOther.get(
                  contact.id
                );


              return `
                <button
                  type="button"
                  class="v36-message-row"
                  data-chat-person="${contact.id}"
                >

                  <div class="v36-message-avatar">
                    ${esc(
                      nameOf(contact)
                      .charAt(0)
                      .toUpperCase()
                    )}
                  </div>

                  <div class="v36-message-row-main">

                    <div class="v36-message-name-row">

                      <strong>
                        ${esc(
                          nameOf(
                            contact
                          )
                        )}
                      </strong>

                      ${
                        Number(
                          thread?.unread_count
                          ||
                          0
                        )
                          ? `
                              <span class="v36-unread">
                                ${Number(
                                  thread.unread_count
                                )}
                              </span>
                            `
                          : ''
                      }

                    </div>

                    <p>
                      ${esc(
                        thread?.last_message
                        ||
                        (
                          C.lang==='ar'
                            ? 'ابدأ محادثة'
                            : 'Start a conversation'
                        )
                      )}
                    </p>

                  </div>

                  <small>
                    ${
                      thread?.last_message_at
                        ? C.formatDate(
                            thread.last_message_at,
                            {
                              hour:'2-digit',
                              minute:'2-digit'
                            }
                          )
                        : ''
                    }
                  </small>

                </button>
              `;
            }
          ).join('')}

        </section>
      `;


      main
        .querySelectorAll(
          '[data-chat-person]'
        )
        .forEach(
          button=>{

            button.onclick =
              ()=>C.route(
                'clinic-chat-thread',
                {
                  otherId:
                    button.dataset
                      .chatPerson
                }
              );
          }
        );
    };


  /*
   * DEDICATED THREAD PAGE.
   */
  window.ClinicPages[
    'clinic-chat-thread'
  ] =
    async function(params={}){

      stopTimer();


      C.setTitle(
        C.lang==='ar'
          ? 'المحادثة'
          : 'Conversation'
      );


      const main =
        document.getElementById(
          'mainContent'
        );


      let people;


      try{

        people =
          await participants();

      }
      catch(error){

        main.innerHTML = `
          <section class="content-card empty-state">
            ${esc(error.message)}
          </section>
        `;

        return;
      }


      const peopleMap =
        new Map(
          people.map(
            p=>[
              p.id,
              p
            ]
          )
        );


      const audit =
        Boolean(
          params.audit
        );


      let otherId =
        params.otherId
        ||
        null;


      let threadId =
        params.threadId
        ||
        null;


      if(
        !threadId
        &&
        otherId
      ){

        try{

          threadId =
            await getOrCreateThread(
              otherId
            );

        }
        catch(error){

          main.innerHTML = `
            <section class="content-card empty-state">
              ${esc(error.message)}
            </section>
          `;

          return;
        }
      }


      async function draw(){

        const rows =
          threadId
            ? await getMessages(
                threadId
              )
            : [];


        if(
          !otherId
          &&
          !audit
        ){

          const related =
            rows.find(
              row=>
                row.sender_id !==
                C.user.id
                ||
                row.recipient_id !==
                C.user.id
            );


          if(related){

            otherId =
              related.sender_id ===
              C.user.id
                ? related.recipient_id
                : related.sender_id;
          }
        }


        const other =
          peopleMap.get(
            otherId
          );


        if(
          otherId
          &&
          !audit
        ){

          await C.sb.rpc(
            'clinic_mark_chat_read',
            {
              p_other:
                otherId
            }
          );
        }


        const heading =
          audit
            ? (
                rows.length
                  ? `${
                      rows[0].sender_name
                      ||
                      'Conversation'
                    }`
                  : 'Conversation'
              )
            : nameOf(
                other
                ||
                {}
              );


        main.innerHTML = `
          <section class="v36-thread-page content-card">

            <header class="v36-thread-header">

              <button
                id="v36BackToMessages"
                type="button"
                class="v36-thread-back"
                aria-label="Back"
              >
                ←
              </button>


              <div class="v36-thread-avatar">
                ${
                  audit
                    ? '💬'
                    : esc(
                        heading
                        .charAt(0)
                        .toUpperCase()
                      )
                }
              </div>


              <div class="v36-thread-title">
                <strong>
                  ${esc(
                    heading
                  )}
                </strong>

                <small>
                  ${
                    audit
                      ? (
                          C.lang==='ar'
                            ? 'عرض المالك - للقراءة فقط'
                            : 'Owner audit - read only'
                        )
                      : (
                          C.lang==='ar'
                            ? 'محادثة العيادة'
                            : 'Clinic conversation'
                        )
                  }
                </small>
              </div>

            </header>


            <div
              id="v36ThreadMessages"
              class="v36-thread-messages"
            >

              ${
                rows.length
                  ? rows.map(
                      row=>`
                        <article
                          class="v36-chat-bubble ${
                            row.sender_id ===
                            C.user.id
                            &&
                            !audit
                              ? 'mine'
                              : 'theirs'
                          }"
                        >
                          ${
                            audit
                              ? `
                                  <strong>
                                    ${esc(
                                      row.sender_name
                                      ||
                                      'User'
                                    )}
                                  </strong>
                                `
                              : ''
                          }

                          <p>
                            ${esc(
                              row.body
                            )}
                          </p>

                          <small>
                            ${C.formatDate(
                              row.created_at,
                              {
                                hour:'2-digit',
                                minute:'2-digit'
                              }
                            )}
                          </small>
                        </article>
                      `
                    ).join('')
                  : `
                      <div class="empty-state">
                        ${
                          C.lang==='ar'
                            ? 'ابدأ المحادثة.'
                            : 'Start the conversation.'
                        }
                      </div>
                    `
              }

            </div>


            ${
              !audit
                ? `
                    <form
                      id="v36ThreadComposer"
                      class="v36-thread-composer"
                    >

                      <textarea
                        id="v36ThreadText"
                        class="control"
                        rows="2"
                        maxlength="4000"
                        placeholder="${
                          C.lang==='ar'
                            ? 'اكتب رسالة...'
                            : 'Type a message...'
                        }"
                        required
                      ></textarea>

                      <button
                        type="submit"
                        class="v36-send-button"
                        aria-label="Send"
                      >
                        ➤
                      </button>

                    </form>
                  `
                : ''
            }

          </section>
        `;


        document
          .getElementById(
            'v36BackToMessages'
          )
          .onclick =
            ()=>C.route(
              'clinic-chat'
            );


        const list =
          document.getElementById(
            'v36ThreadMessages'
          );


        if(list){

          list.scrollTop =
            list.scrollHeight;
        }


        const composer =
          document.getElementById(
            'v36ThreadComposer'
          );


        if(composer){

          composer.onsubmit =
            async event=>{

              event.preventDefault();


              const input =
                document.getElementById(
                  'v36ThreadText'
                );


              const body =
                input.value.trim();


              if(!body){
                return;
              }


              try{

                await sendMessage(
                  otherId,
                  body
                );


                input.value =
                  '';


                await draw();

              }
              catch(error){

                C.toast(
                  error.message,
                  'error'
                );
              }
            };
        }
      }


      try{

        await draw();

      }
      catch(error){

        main.innerHTML = `
          <section class="content-card empty-state">
            ${esc(error.message)}
          </section>
        `;

        return;
      }


      /*
       * Messenger-like live refresh while the thread is open.
       */
      timer =
        setInterval(
          async()=>{

            if(
              C.currentPage !==
              'clinic-chat-thread'
            ){

              stopTimer();

              return;
            }


            const input =
              document.getElementById(
                'v36ThreadText'
              );


            if(
              input?.matches(':focus')
              &&
              input.value
            ){
              return;
            }


            try{

              await draw();

            }
            catch(error){

              console.warn(
                'Thread refresh failed',
                error
              );
            }

          },
          3500
        );
    };


  const style =
    document.createElement(
      'style'
    );


  style.textContent = `
    .v36-message-list {
      display: grid;
      gap: 0;
      padding: 0 !important;
      overflow: hidden;
    }

    .v36-message-row {
      width: 100%;
      display: grid;
      grid-template-columns:
        52px
        minmax(0,1fr)
        auto;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      border: 0;
      border-bottom: 1px solid #e7ebef;
      background: white;
      color: inherit;
      cursor: pointer;
      text-align: inherit;
    }

    .v36-message-row:hover {
      background: #f8fbfa;
    }

    .v36-message-avatar,
    .v36-thread-avatar {
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: #e4f4f0;
      color: #087260;
      font-weight: 900;
    }

    .v36-message-avatar {
      width: 48px;
      height: 48px;
    }

    .v36-message-row-main {
      min-width: 0;
      display: grid;
      gap: 4px;
    }

    .v36-message-name-row {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .v36-message-row-main p {
      margin: 0;
      color: #748197;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .v36-message-row > small {
      color: #8893a2;
      font-size: 9px;
    }

    .v36-unread {
      min-width: 22px;
      height: 22px;
      display: grid;
      place-items: center;
      padding: 0 6px;
      border-radius: 999px;
      background: #0f8b78;
      color: white;
      font-size: 9px;
      font-weight: 900;
    }

    .v36-thread-page {
      height: calc(100vh - 165px);
      min-height: 540px;
      padding: 0 !important;
      display: grid;
      grid-template-rows:
        auto
        minmax(0,1fr)
        auto;
      overflow: hidden;
    }

    .v36-thread-header {
      min-height: 72px;
      display: grid;
      grid-template-columns:
        auto
        auto
        minmax(0,1fr);
      gap: 11px;
      align-items: center;
      padding: 11px 16px;
      border-bottom: 1px solid #e4e9ee;
      background: white;
    }

    .v36-thread-back {
      width: 38px;
      height: 38px;
      border: 1px solid #dce4eb;
      border-radius: 11px;
      background: white;
      cursor: pointer;
      font-size: 20px;
    }

    .v36-thread-avatar {
      width: 44px;
      height: 44px;
    }

    .v36-thread-title {
      display: grid;
      gap: 2px;
    }

    .v36-thread-title strong {
      font-size: 15px;
    }

    .v36-thread-title small {
      color: #748196;
    }

    .v36-thread-messages {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 18px 20px;
      background:
        linear-gradient(
          180deg,
          #f7f9fb 0%,
          #ffffff 100%
        );
    }

    .v36-chat-bubble {
      width: fit-content;
      max-width: min(72%, 620px);
      padding: 9px 12px;
      border-radius: 17px;
      border: 1px solid #dfe5ea;
      background: white;
    }

    .v36-chat-bubble.mine {
      align-self: flex-end;
      border-color: #b7dfd5;
      background: #dff5ef;
      border-bottom-right-radius: 5px;
    }

    .v36-chat-bubble.theirs {
      align-self: flex-start;
      border-bottom-left-radius: 5px;
    }

    .v36-chat-bubble p {
      margin: 0 0 3px;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .v36-chat-bubble small {
      display: block;
      color: #8792a1;
      font-size: 8px;
      text-align: end;
    }

    .v36-thread-composer {
      display: grid;
      grid-template-columns:
        minmax(0,1fr)
        auto;
      gap: 8px;
      align-items: end;
      padding: 10px 14px;
      border-top: 1px solid #e3e8ed;
      background: white;
    }

    .v36-thread-composer textarea {
      min-height: 46px;
      max-height: 120px;
      resize: vertical;
      border-radius: 18px !important;
    }

    .v36-send-button {
      width: 46px;
      height: 46px;
      border: 0;
      border-radius: 999px;
      background: #0f8b78;
      color: white;
      cursor: pointer;
      font-size: 18px;
    }

    @media (max-width: 760px) {

      .v36-thread-page {
        height: calc(100vh - 115px);
        min-height: 460px;
      }

      .v36-chat-bubble {
        max-width: 86%;
      }

      .v36-message-row {
        grid-template-columns:
          46px
          minmax(0,1fr)
          auto;
        padding-inline: 10px;
      }

      .v36-message-avatar {
        width: 42px;
        height: 42px;
      }
    }
  `;


  document.head.appendChild(
    style
  );

})();
