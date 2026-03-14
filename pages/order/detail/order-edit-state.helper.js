function getAdminEditOrderState(input = {}) {
  const {
    isAdmin = false,
    orderStatus = 0,
    isSharedView = false
  } = input;

  const EDITABLE_ORDER_STATUSES = [0, 1]; // CREATED / PROCESSING
  const ADMIN_EDIT_ROUTE_PATH = '/pages/admin/order/edit/edit';
  const isSharedDetailLaunchOnlyForAdminEdit = isAdmin && isSharedView;
  const canAdminEditByStatus = isAdmin && EDITABLE_ORDER_STATUSES.includes(orderStatus);
  const showEditOrderEntry = canAdminEditByStatus;
  const isImmutable = orderStatus >= 3;

  return {
    showEditOrderEntry,
    showAppendItemsEntry: false,
    adminEditRoutePath: ADMIN_EDIT_ROUTE_PATH,
    isSharedDetailLaunchOnlyForAdminEdit,
    isAdminContentEditReadOnly: isSharedDetailLaunchOnlyForAdminEdit,
    isImmutable,
    isAdmin
  };
}

module.exports = {
  getAdminEditOrderState
};
