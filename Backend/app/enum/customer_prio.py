from enum import Enum


class CustomerPrio(str, Enum):
    can_work = "Stoerung aber kann arbeiten"
    can_not_work = "Stoerung kann nicht arbeiten"
    multiple_people_can_not_work = "Stoerung mehrere können nicht arbeiten"
    department_can_not_work = "Stoerung Abteilung kann nicht arbeiten"
