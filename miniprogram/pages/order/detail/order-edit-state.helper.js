const {
  ORDER_FLOW_STATUS,
  WORKFLOW_MILESTONE,
  getWorkflowMilestone
} = require('../../../config/constants.js')

function getAdminEditOrderState(input = {}) {
  const {
    isAdmin = false,
    orderStatus = 0,
    paymentStatus,
    waitForBind,
    contentConfirmedAt,
    workflowMilestone,
    isSharedView = false
  } = input;

  const ADMIN_EDIT_ROUTE_PATH = '/pages/admin/order/edit/edit';
  const isSharedDetailLaunchOnlyForAdminEdit = isAdmin && isSharedView;
  const derivedWorkflowMilestone = workflowMilestone || getWorkflowMilestone({
    orderStatus,
    paymentStatus,
    waitForBind,
    contentConfirmedAt
  });

  const isPreServiceEditable = [
    WORKFLOW_MILESTONE.CLAIMED_UNCONFIRMED,
    WORKFLOW_MILESTONE.CONFIRMED_READY_FOR_SERVICE
  ].includes(derivedWorkflowMilestone);
  const isProcessingEditable = derivedWorkflowMilestone === WORKFLOW_MILESTONE.PROCESSING;
  const showEditOrderEntry = isAdmin && (isPreServiceEditable || isProcessingEditable);
  const showAppendItemsEntry = isAdmin && isProcessingEditable;
  const isImmutable = [
    WORKFLOW_MILESTONE.SERVICE_DONE_UNPAID,
    WORKFLOW_MILESTONE.COMPLETED,
    WORKFLOW_MILESTONE.CANCELLED
  ].includes(derivedWorkflowMilestone)
    || orderStatus >= ORDER_FLOW_STATUS.COMPLETED;

  return {
    workflowMilestone: derivedWorkflowMilestone,
    showEditOrderEntry,
    showAppendItemsEntry,
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