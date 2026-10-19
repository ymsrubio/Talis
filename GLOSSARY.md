# Bus Attendance

Tracks which children are on the school bus today, so parents can see it on a public page.

## Language

**Rider**:
A child registered to ride the bus, identified by their Card.
_Avoid_: Student, passenger, kid

**Card**:
The RFID card a Rider taps on the reader; its UID links it to exactly one Rider.
_Avoid_: Tag, badge

**Unknown Card**:
A Card whose UID is not linked to any Rider yet.

**Registration**:
Turning an Unknown Card into a Rider by giving it a name and a Seat.
_Avoid_: Sign-up, enrollment

**Seat**:
A numbered place on the bus. Every Rider is assigned exactly one Seat, and a Seat holds at most one Rider.

**Bus Layout**:
The arrangement of Seats and fixtures (driver, door, aisle, toilet) that the seat map is drawn from.
_Avoid_: Floor plan, seat chart

**Parent**:
Anyone viewing the page to check a Rider's Status.
_Avoid_: Guardian, user

**Tap**:
One read of a Card by the reader on the bus. A repeat read of the same Card within one minute is not a new Tap.
_Avoid_: Scan, check-in

**Boarding**:
A Tap that marks a Rider as getting on the bus: the Rider's 1st, 3rd, 5th… Tap of the Day.

**Drop-off**:
A Tap that marks a Rider as getting off the bus: the Rider's 2nd, 4th, 6th… Tap of the Day.
_Avoid_: Alighting, check-out

**Day**:
The calendar day attendance is shown for; each Day starts with no Riders on the bus.

**Status**:
Where a Rider is right now on the current Day: _Not yet_ (no Tap today), _On bus_ (last Tap was a Boarding), or _Dropped off_ (last Tap was a Drop-off).

## Relationships

- There is one bus, drawn from one **Bus Layout**
- A **Rider** has one **Card** and one **Seat**
- **Registration** turns an **Unknown Card** into a **Rider**; removing a Rider makes their Card unknown again
- Each **Tap** is either a **Boarding** or a **Drop-off**
- Every **Rider** has exactly one **Status** per **Day**, derived from that Day's **Taps**
