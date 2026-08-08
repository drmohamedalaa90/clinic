(function(){
  const C=()=>window.Clinic;

  function itemLabel(item){
    const c=C();

    return c.lang==='ar'
      ? (
          item.item_name_ar||
          item.item_name_en
        )
      : item.item_name_en;
  }


  function orderStatusMessage(status){
    const c=C();

    const labels={
      requested:
        c.lang==='ar'
          ?'بانتظار موافقة الإدارة'
          :'Awaiting management approval',

      approved:
        c.lang==='ar'
          ?'تمت الموافقة — أدخل السعر في المالية'
          :'Approved — enter purchase price in Finance',

      paid:
        c.lang==='ar'
          ?'تم تسجيل السعر — بانتظار الاستلام / الإكمال'
          :'Price recorded — awaiting receipt/completion',

      completed:
        c.lang==='ar'
          ?'مكتمل'
          :'Completed',

      rejected:
        c.lang==='ar'
          ?'مرفوض'
          :'Rejected',

      cancelled:
        c.lang==='ar'
          ?'ملغي'
          :'Cancelled'
    };

    return labels[status]||status;
  }


  async function render(){
    const c=C();

    if(!c.isReception()){
      return c.route('dashboard');
    }


    c.setTitle(
      c.t('logistics')
    );


    const [
      catalogResult,
      requestsResult,
      catsResult
    ] = await Promise.all([

      c.sb
        .from('logistics_catalog')
        .select('*')
        .order(
          'display_order',
          {ascending:true}
        )
        .order(
          'item_name_en',
          {ascending:true}
        ),

      c.sb
        .from('logistics_requests')
        .select('*')
        .order(
          'requested_at',
          {ascending:false}
        )
        .limit(200),

      c.sb
        .from('expense_categories')
        .select('*')
        .eq(
          'is_active',
          true
        )
        .order('name_en')

    ]);


    if(catalogResult.error){
      return c.toast(
        catalogResult.error.message,
        'error'
      );
    }


    const catalog=
      catalogResult.data||[];

    const requests=
      requestsResult.data||[];

    const cats=
      catsResult.data||[];

    const catMap=
      new Map(
        cats.map(x=>[
          x.id,
          x
        ])
      );


    const openByCatalog=
      new Map();

    requests
      .filter(r=>
        r.catalog_item_id
        &&
        ![
          'completed',
          'rejected',
          'cancelled'
        ].includes(r.status)
      )
      .forEach(r=>{
        if(
          !openByCatalog.has(
            r.catalog_item_id
          )
        ){
          openByCatalog.set(
            r.catalog_item_id,
            r
          );
        }
      });


    document
      .getElementById(
        'mainContent'
      )
      .innerHTML=`

        <section class="page-toolbar">

          <div>

            <span class="eyebrow">
              OPERATIONS
            </span>

            <h2>
              ${c.lang==='ar'
                ?'احتياجات العيادة'
                :'Clinic logistics'}
            </h2>

            <p class="muted">
              ${c.lang==='ar'
                ?'المالك يحدد القائمة الأساسية لاحتياجات العيادة، والسكرتارية تختار منها ما هو ناقص وترسل طلب الشراء.'
                :'The Owner controls the clinic master list. The secretary selects what is missing and sends it for approval.'}
            </p>

          </div>


          <div class="toolbar-actions">

            ${c.hasRole('owner')
              ? `
                  <button
                    id="addCatalogItem"
                    class="primary-button compact"
                  >
                    + ${c.lang==='ar'
                      ?'إضافة احتياج'
                      :'Add clinic item'}
                  </button>
                `
              : ''
            }

          </div>

        </section>


        <div
          class="logistics-flow-strip"
        >

          <span>
            <b>1</b>
            ${c.lang==='ar'
              ?'المالك يحدد القائمة'
              :'Owner controls list'}
          </span>

          <i>→</i>

          <span>
            <b>2</b>
            ${c.lang==='ar'
              ?'السكرتارية تحدد الناقص'
              :'Secretary reports missing'}
          </span>

          <i>→</i>

          <span>
            <b>3</b>
            ${c.lang==='ar'
              ?'الإدارة توافق'
              :'Management approves'}
          </span>

          <i>→</i>

          <span>
            <b>4</b>
            ${c.lang==='ar'
              ?'السعر يُسجل في المالية'
              :'Price entered in Finance'}
          </span>

        </div>


        <div
          class="tabs"
          id="logTabs"
        >

          <button
            class="tab active"
            data-tab="catalog"
          >
            ${c.lang==='ar'
              ?'قائمة احتياجات العيادة'
              :'Clinic items'}
          </button>

          <button
            class="tab"
            data-tab="orders"
          >
            ${c.lang==='ar'
              ?'طلبات الشراء'
              :'Orders'}
          </button>

        </div>


        <section class="content-card">

          <div id="logArea"></div>

        </section>
      `;


    const area=
      document.getElementById(
        'logArea'
      );


    function renderCatalog(){

      const visible=
        c.hasRole('owner')
          ? catalog
          : catalog.filter(
              item=>item.is_active
            );


      area.innerHTML=visible.length
        ? `

          <div class="logistics-catalog-grid">

            ${visible.map(item=>{

              const openRequest=
                openByCatalog.get(
                  item.id
                );

              const category=
                catMap.get(
                  item.category_id
                );


              return `

                <article
                  class="
                    logistics-catalog-card
                    ${
                      !item.is_active
                        ? 'inactive'
                        : ''
                    }
                    ${
                      openRequest
                        ? 'has-order'
                        : ''
                    }
                  "
                >

                  <div class="logistics-catalog-card-head">

                    <div>

                      <span
                        class="logistics-item-icon"
                      >
                        📦
                      </span>

                      <div>

                        <strong>
                          ${c.escape(
                            itemLabel(item)
                          )}
                        </strong>

                        <small>
                          ${c.escape(
                            category?.name_en||
                            (
                              c.lang==='ar'
                                ?'بدون فئة'
                                :'Uncategorized'
                            )
                          )}
                        </small>

                      </div>

                    </div>


                    ${
                      item.is_active

                      ? `<span class="catalog-active-chip">
                           ${c.lang==='ar'
                             ?'نشط'
                             :'Active'}
                         </span>`

                      : `<span class="catalog-inactive-chip">
                           ${c.lang==='ar'
                             ?'معطل'
                             :'Inactive'}
                         </span>`
                    }

                  </div>


                  <div
                    class="logistics-catalog-meta"
                  >

                    <span>

                      <b>
                        ${item.default_quantity||'—'}
                      </b>

                      ${c.escape(
                        item.unit||''
                      )}

                    </span>

                    ${
                      item.notes

                      ? `<small>
                           ${c.escape(
                             item.notes
                           )}
                         </small>`

                      : ''
                    }

                  </div>


                  ${
                    openRequest

                    ? `

                      <div
                        class="catalog-open-order"
                      >

                        <span>
                          ${c.statusPill(
                            openRequest.status
                          )}
                        </span>

                        <strong>
                          ${c.escape(
                            orderStatusMessage(
                              openRequest.status
                            )
                          )}
                        </strong>

                      </div>

                    `

                    : ''
                  }


                  <div
                    class="logistics-catalog-actions"
                  >

                    ${
                      c.hasRole('secretary')
                      &&
                      item.is_active
                      &&
                      !openRequest

                      ? `

                        <button
                          class="primary-button compact"
                          data-order-catalog="${item.id}"
                        >
                          ${c.lang==='ar'
                            ?'ناقص — اطلب الآن'
                            :'Missing — order'}
                        </button>

                      `

                      : ''
                    }


                    ${
                      c.hasRole('owner')

                      ? `

                        <button
                          class="secondary-button compact"
                          data-edit-catalog="${item.id}"
                        >
                          ${c.lang==='ar'
                            ?'تعديل'
                            :'Edit'}
                        </button>


                        <button
                          class="
                            table-action
                            ${
                              item.is_active
                                ? 'danger-outline'
                                : 'success-outline'
                            }
                          "
                          data-toggle-catalog="${item.id}"
                          data-active="${item.is_active?'1':'0'}"
                        >
                          ${item.is_active
                            ? (
                                c.lang==='ar'
                                  ?'تعطيل'
                                  :'Disable'
                              )
                            : (
                                c.lang==='ar'
                                  ?'تفعيل'
                                  :'Activate'
                              )
                          }
                        </button>

                      `

                      : ''
                    }

                  </div>

                </article>
              `;

            }).join('')}

          </div>
        `

        : `

          <div class="empty-state">

            <strong>
              ${c.lang==='ar'
                ?'لم تتم إضافة قائمة احتياجات العيادة بعد.'
                :'The clinic logistics list is empty.'}
            </strong>

            ${
              c.hasRole('owner')

              ? `<span>
                   ${c.lang==='ar'
                     ?'اضغط "إضافة احتياج" لبدء القائمة.'
                     :'Use “Add clinic item” to build the master list.'}
                 </span>`

              : ''
            }

          </div>
        `;


      area
        .querySelectorAll(
          '[data-order-catalog]'
        )
        .forEach(button=>{

          button.onclick=()=>{

            const item=
              catalog.find(
                x=>x.id===
                  button.dataset.orderCatalog
              );

            orderMissingModal(
              item
            );
          };

        });


      area
        .querySelectorAll(
          '[data-edit-catalog]'
        )
        .forEach(button=>{

          button.onclick=()=>{

            const item=
              catalog.find(
                x=>x.id===
                  button.dataset.editCatalog
              );

            catalogModal(
              item
            );
          };

        });


      area
        .querySelectorAll(
          '[data-toggle-catalog]'
        )
        .forEach(button=>{

          button.onclick=async()=>{

            const isActive=
              button.dataset.active==='1';

            const {error}=await c.sb.rpc(
              'owner_set_logistics_catalog_active',
              {
                p_item_id:
                  button.dataset.toggleCatalog,

                p_is_active:
                  !isActive
              }
            );


            if(error){
              return c.toast(
                error.message,
                'error'
              );
            }


            c.toast(
              c.lang==='ar'
                ?'تم تحديث القائمة.'
                :'Clinic item updated.'
            );

            c.route('logistics');
          };

        });
    }


    function renderOrders(){

      area.innerHTML=requests.length
        ? `

          <div class="stack-list">

            ${requests.map(r=>{

              const cat=
                catMap.get(
                  r.category_id
                )||{};


              return `

                <article
                  class="
                    list-card
                    ${
                      r.is_deficiency
                        ? 'logistics-deficiency-card'
                        : ''
                    }
                  "
                >

                  <div>

                    <div class="referral-topline">

                      ${c.statusPill(
                        r.status
                      )}

                      ${
                        r.urgency==='urgent'
                          ? '<span class="urgent-tag">URGENT</span>'
                          : ''
                      }

                      ${
                        r.is_deficiency
                          ? `
                              <span class="deficiency-tag">
                                ${c.lang==='ar'
                                  ?'ناقص'
                                  :'MISSING'}
                              </span>
                            `
                          : ''
                      }

                    </div>


                    <div class="list-title">

                      ${c.escape(
                        r.item_name
                      )}

                    </div>


                    <div class="small-note">

                      ${c.escape(
                        cat.name_en||
                        'Other'
                      )}

                      •

                      ${r.quantity||'—'}

                      ${c.escape(
                        r.unit||''
                      )}

                      ${r.needed_by
                        ? ` • ${
                            c.lang==='ar'
                              ?'مطلوب'
                              :'Needed'
                          } ${c.formatDate(r.needed_by)}`
                        : ''
                      }

                    </div>


                    <div
                      class="logistics-order-state"
                    >
                      ${c.escape(
                        orderStatusMessage(
                          r.status
                        )
                      )}
                    </div>


                    ${
                      r.request_notes

                      ? `<div class="small-note">
                           ${c.escape(
                             r.request_notes
                           )}
                         </div>`

                      : ''
                    }

                  </div>


                  <div class="list-actions">

                    ${
                      c.isManagement()
                      &&
                      r.status==='requested'

                      ? `

                        <button
                          class="table-action success-outline"
                          data-review="${r.id}"
                          data-action="approve"
                        >
                          ${c.lang==='ar'
                            ?'موافقة'
                            :'Approve'}
                        </button>


                        <button
                          class="table-action danger-outline"
                          data-review="${r.id}"
                          data-action="reject"
                        >
                          ${c.lang==='ar'
                            ?'رفض'
                            :'Reject'}
                        </button>

                      `

                      : ''
                    }


                    ${
                      r.status==='approved'

                      ? `

                        <button
                          class="table-action finance-link-button"
                          data-go-finance="1"
                        >
                          💳
                          ${c.lang==='ar'
                            ?'أدخل السعر في المالية'
                            :'Enter price in Finance'}
                        </button>

                      `

                      : ''
                    }


                    ${
                      r.status==='paid'

                      ? `

                        <button
                          class="table-action success-outline"
                          data-complete="${r.id}"
                        >
                          ${c.lang==='ar'
                            ?'تم الاستلام — إكمال'
                            :'Received — complete'}
                        </button>

                      `

                      : ''
                    }

                  </div>

                </article>
              `;

            }).join('')}

          </div>
        `

        : `

          <div class="empty-state">
            ${c.lang==='ar'
              ?'لا توجد طلبات شراء.'
              :'No logistics orders yet.'}
          </div>
        `;


      area
        .querySelectorAll(
          '[data-review]'
        )
        .forEach(button=>{

          button.onclick=()=>reviewRequest(
            button.dataset.review,
            button.dataset.action
          );

        });


      area
        .querySelectorAll(
          '[data-go-finance]'
        )
        .forEach(button=>{

          button.onclick=
            ()=>c.route('finance');

        });


      area
        .querySelectorAll(
          '[data-complete]'
        )
        .forEach(button=>{

          button.onclick=()=>completeRequest(
            button.dataset.complete
          );

        });
    }


    function catalogModal(item=null){

      c.showModal({

        title:
          item

            ? (
                c.lang==='ar'
                  ?'تعديل احتياج'
                  :'Edit clinic item'
              )

            : (
                c.lang==='ar'
                  ?'إضافة احتياج للعيادة'
                  :'Add clinic item'
              ),

        body:`

          <form
            id="catalogForm"
            class="form-grid"
          >

            <label>

              ${c.lang==='ar'
                ?'الاسم بالإنجليزية'
                :'English name'}

              <input
                id="catNameEn"
                class="control"
                value="${c.escape(
                  item?.item_name_en||
                  ''
                )}"
                required
              >

            </label>


            <label>

              ${c.lang==='ar'
                ?'الاسم بالعربية'
                :'Arabic name'}

              <input
                id="catNameAr"
                class="control"
                value="${c.escape(
                  item?.item_name_ar||
                  ''
                )}"
              >

            </label>


            <label>

              ${c.lang==='ar'
                ?'الفئة'
                :'Category'}

              <select
                id="catCategory"
                class="control"
              >

                <option value="">
                  —
                </option>

                ${cats.map(cat=>`

                  <option
                    value="${cat.id}"
                    ${
                      cat.id===
                      item?.category_id
                        ?'selected'
                        :''
                    }
                  >
                    ${c.escape(
                      cat.name_en
                    )}
                  </option>

                `).join('')}

              </select>

            </label>


            <label>

              ${c.lang==='ar'
                ?'الكمية المعتادة'
                :'Default quantity'}

              <input
                id="catQty"
                class="control"
                type="number"
                min="0.01"
                step="0.01"
                value="${item?.default_quantity??''}"
              >

            </label>


            <label>

              ${c.lang==='ar'
                ?'الوحدة'
                :'Unit'}

              <input
                id="catUnit"
                class="control"
                placeholder="${
                  c.lang==='ar'
                    ?'علبة / زجاجة / قطعة'
                    :'box / bottle / piece'
                }"
                value="${c.escape(
                  item?.unit||
                  ''
                )}"
              >

            </label>


            <label>

              ${c.lang==='ar'
                ?'ترتيب الظهور'
                :'Display order'}

              <input
                id="catOrder"
                class="control"
                type="number"
                step="1"
                value="${item?.display_order??100}"
              >

            </label>


            <label class="full-span">

              ${c.lang==='ar'
                ?'ملاحظات'
                :'Notes'}

              <textarea
                id="catNotes"
                class="control"
              >${c.escape(
                item?.notes||
                ''
              )}</textarea>

            </label>


            <label class="checkbox-card full-span">

              <input
                id="catActive"
                type="checkbox"
                ${
                  item?.is_active===false
                    ?''
                    :'checked'
                }
              >

              <span>

                <strong>
                  ${c.lang==='ar'
                    ?'موجود في القائمة'
                    :'Active clinic item'}
                </strong>

                <small>
                  ${c.lang==='ar'
                    ?'يظهر للسكرتارية ضمن قائمة احتياجات العيادة.'
                    :'Visible to the secretary in the clinic logistics list.'}
                </small>

              </span>

            </label>


            <div class="form-actions full-span">

              <button
                class="primary-button compact"
                type="submit"
              >
                ${c.lang==='ar'
                  ?'حفظ'
                  :'Save'}
              </button>

            </div>

          </form>
        `,

        onOpen:(root)=>{

          root
            .querySelector(
              '#catalogForm'
            )
            .onsubmit=async event=>{

              event.preventDefault();


              const qtyText=
                root
                  .querySelector(
                    '#catQty'
                  )
                  .value
                  .trim();


              const {error}=await c.sb.rpc(
                'owner_save_logistics_catalog_item',
                {
                  p_item_id:
                    item?.id||
                    null,

                  p_item_name_en:
                    root
                      .querySelector(
                        '#catNameEn'
                      )
                      .value,

                  p_item_name_ar:
                    root
                      .querySelector(
                        '#catNameAr'
                      )
                      .value||
                    null,

                  p_category_id:
                    root
                      .querySelector(
                        '#catCategory'
                      )
                      .value||
                    null,

                  p_default_quantity:
                    qtyText
                      ? Number(qtyText)
                      : null,

                  p_unit:
                    root
                      .querySelector(
                        '#catUnit'
                      )
                      .value||
                    null,

                  p_notes:
                    root
                      .querySelector(
                        '#catNotes'
                      )
                      .value||
                    null,

                  p_display_order:
                    Number(
                      root
                        .querySelector(
                          '#catOrder'
                        )
                        .value||
                      100
                    ),

                  p_is_active:
                    root
                      .querySelector(
                        '#catActive'
                      )
                      .checked
                }
              );


              if(error){
                return c.toast(
                  error.message,
                  'error'
                );
              }


              c.closeModal();


              c.toast(
                c.lang==='ar'
                  ?'تم حفظ قائمة الاحتياجات.'
                  :'Clinic logistics list saved.'
              );


              c.route(
                'logistics'
              );
            };
        }
      });
    }


    function orderMissingModal(item){

      if(!item){
        return;
      }


      c.showModal({

        title:
          c.lang==='ar'
            ?'طلب بند ناقص'
            :'Order missing clinic item',

        body:`

          <form
            id="missingOrderForm"
            class="form-grid"
          >

            <div
              class="missing-order-item full-span"
            >

              <span>
                📦
              </span>

              <div>

                <strong>
                  ${c.escape(
                    itemLabel(item)
                  )}
                </strong>

                <small>
                  ${c.lang==='ar'
                    ?'سيصل إشعار للمالك والمديرين للموافقة.'
                    :'Owner and managers will receive an approval notification.'}
                </small>

              </div>

            </div>


            <label>

              ${c.lang==='ar'
                ?'الكمية المطلوبة'
                :'Quantity needed'}

              <input
                id="missingQty"
                class="control"
                type="number"
                min="0.01"
                step="0.01"
                value="${item.default_quantity??1}"
                required
              >

            </label>


            <label>

              ${c.lang==='ar'
                ?'الوحدة'
                :'Unit'}

              <input
                class="control"
                value="${c.escape(
                  item.unit||
                  ''
                )}"
                disabled
              >

            </label>


            <label>

              ${c.lang==='ar'
                ?'الأولوية'
                :'Urgency'}

              <select
                id="missingUrgency"
                class="control"
              >
                <option value="routine">
                  ${c.lang==='ar'
                    ?'عادي'
                    :'Routine'}
                </option>

                <option value="urgent">
                  ${c.lang==='ar'
                    ?'عاجل'
                    :'Urgent'}
                </option>
              </select>

            </label>


            <label>

              ${c.lang==='ar'
                ?'مطلوب قبل'
                :'Needed by'}

              <input
                id="missingNeededBy"
                class="control"
                type="date"
              >

            </label>


            <label class="full-span">

              ${c.lang==='ar'
                ?'ملاحظة'
                :'Note'}

              <textarea
                id="missingNote"
                class="control"
                placeholder="${
                  c.lang==='ar'
                    ?'مثال: المخزون انتهى'
                    :'Example: stock is finished'
                }"
              ></textarea>

            </label>


            <div class="form-actions full-span">

              <button
                class="primary-button compact"
                type="submit"
              >
                ${c.lang==='ar'
                  ?'إرسال طلب الشراء'
                  :'Send order request'}
              </button>

            </div>

          </form>
        `,

        onOpen:(root)=>{

          root
            .querySelector(
              '#missingOrderForm'
            )
            .onsubmit=async event=>{

              event.preventDefault();


              const {error}=await c.sb.rpc(
                'secretary_order_missing_logistics_item',
                {
                  p_catalog_item_id:
                    item.id,

                  p_quantity:
                    Number(
                      root
                        .querySelector(
                          '#missingQty'
                        )
                        .value
                    ),

                  p_needed_by:
                    root
                      .querySelector(
                        '#missingNeededBy'
                      )
                      .value||
                    null,

                  p_urgency:
                    root
                      .querySelector(
                        '#missingUrgency'
                      )
                      .value,

                  p_note:
                    root
                      .querySelector(
                        '#missingNote'
                      )
                      .value||
                    null
                }
              );


              if(error){
                return c.toast(
                  error.message,
                  'error'
                );
              }


              c.closeModal();


              c.toast(
                c.lang==='ar'
                  ?'تم إرسال الطلب إلى الإدارة.'
                  :'Order sent to management.'
              );


              window
                .ClinicNotifications
                ?.refresh?.();


              c.route(
                'logistics'
              );
            };
        }
      });
    }


    async function reviewRequest(
      id,
      action
    ){

      let note=null;


      if(action==='reject'){

        note=prompt(
          c.lang==='ar'
            ?'سبب الرفض'
            :'Rejection reason'
        );


        if(!note){
          return;
        }
      }


      const {error}=await c.sb.rpc(
        'review_logistics_request',
        {
          p_request_id:
            id,

          p_action:
            action,

          p_note:
            note
        }
      );


      if(error){
        return c.toast(
          error.message,
          'error'
        );
      }


      c.toast(
        action==='approve'
          ? (
              c.lang==='ar'
                ?'تمت الموافقة. السعر يُسجل الآن من صفحة المالية.'
                :'Approved. The actual price can now be entered in Finance.'
            )
          : (
              c.lang==='ar'
                ?'تم رفض الطلب.'
                :'Request rejected.'
            )
      );


      window
        .ClinicNotifications
        ?.refresh?.();


      c.route(
        'logistics'
      );
    }


    async function completeRequest(id){

      const {error}=await c.sb.rpc(
        'complete_logistics_request',
        {
          p_request_id:
            id
        }
      );


      if(error){
        return c.toast(
          error.message,
          'error'
        );
      }


      c.toast(
        c.lang==='ar'
          ?'تم استلام الاحتياج وإكمال الطلب.'
          :'Item received and order completed.'
      );


      window
        .ClinicNotifications
        ?.refresh?.();


      c.route(
        'logistics'
      );
    }


    document
      .querySelectorAll(
        '#logTabs .tab'
      )
      .forEach(button=>{

        button.onclick=()=>{

          document
            .querySelectorAll(
              '#logTabs .tab'
            )
            .forEach(
              x=>x.classList.remove(
                'active'
              )
            );


          button.classList.add(
            'active'
          );


          button.dataset.tab==='catalog'
            ? renderCatalog()
            : renderOrders();
        };
      });


    document
      .getElementById(
        'addCatalogItem'
      )
      ?.addEventListener(
        'click',
        ()=>catalogModal()
      );


    renderCatalog();
  }


  window.ClinicPages['logistics']=
    render;

})();
