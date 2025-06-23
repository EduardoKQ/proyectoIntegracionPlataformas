from api.models import Worker
from django.shortcuts import get_object_or_404


# get worker branch
def get_worker_branch(user):
    """
    Get the branch code for a worker user.
    """
    try:
        # get the worker instance for the user
        worker = get_object_or_404(Worker, user_account=user)
        # get the branch code for that worker
        branch = worker.branch
        # return the branch code
        return branch.branch_code
    except AttributeError:
        return None
