<?php

namespace App\Repository;

use App\Entity\Moves;
use App\Entity\User;
use App\Entity\Repertoire;
use DateTime;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * @extends ServiceEntityRepository<Repertoire>
 */
class RepertoireRepository extends ServiceEntityRepository
{
    private $user = null;
    private $settings = null;

    public function __construct(ManagerRegistry $registry, private Security $security)
    {
        parent::__construct($registry, Repertoire::class);

        $this->user = $security->getUser();
        if ($this->user instanceof User) {
            $this->settings = $this->user->getSettings();
        }
    }

    public function fenCompare($fenSource, $fenTarget): string
    {
        // split the FEN, get the parts and replace the ep square with a dash
        $parts = explode(" ", $fenSource);
        $fenSourceDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];
        $parts = explode(" ", $fenTarget);
        $fenTargetDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];

        return $fenSource == $fenTarget || $fenSource == $fenTargetDash || $fenSourceDash == $fenTarget || $fenSourceDash == $fenTargetDash;
    }

    public function findOneBy(array $criteria, array|null $orderBy = null): object|null
    {
        // if the FenBefore is set
        if (isset($criteria['FenBefore'])) {
            // get the FenBefore with a dash instead of ep
            $parts = explode(" ", $criteria['FenBefore']);
            $fenBeforeDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];
            // if the FenBefore with a dash differs, search for both
            if ($fenBeforeDash != $criteria['FenBefore']) {
                $criteria['FenBefore'] = [$criteria['FenBefore'], $fenBeforeDash];
            }
        }
        // if the FenAfter is set
        if (isset($criteria['FenAfter'])) {
            // get the FenAfter with a dash instead of ep
            $parts = explode(" ", $criteria['FenAfter']);
            $fenAfterDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];
            // if the FenBefore with a dash differs, search for both
            if ($fenAfterDash != $criteria['FenAfter']) {
                $criteria['FenAfter'] = [$criteria['FenAfter'], $fenAfterDash];
            }
        }

        return parent::findOneBy($criteria, $orderBy);
    }

    public function findBy(array $criteria, array|null $orderBy = null, int|null $limit = null, int|null $offset = null): array
    {
        // if the FenBefore is set
        if (isset($criteria['FenBefore'])) {
            // get the FenBefore with a dash instead of ep
            $parts = explode(" ", $criteria['FenBefore']);
            $fenBeforeDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];
            // if the FenBefore with a dash differs, search for both
            if ($fenBeforeDash != $criteria['FenBefore']) {
                $criteria['FenBefore'] = [$criteria['FenBefore'], $fenBeforeDash];
            }
        }
        // if the FenAfter is set
        if (isset($criteria['FenAfter'])) {
            // get the FenAfter with a dash instead of ep
            $parts = explode(" ", $criteria['FenAfter']);
            $fenAfterDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];
            // if the FenBefore with a dash differs, search for both
            if ($fenAfterDash != $criteria['FenAfter']) {
                $criteria['FenAfter'] = [$criteria['FenAfter'], $fenAfterDash];
            }
        }

        return parent::findBy($criteria, $orderBy, $limit, $offset);
    }

    // is the current position included or are all parent moves at some point excluded
    public function isIncluded(string $fenBefore): bool
    {
        $included = false;

        $res = $this->findBy([
            "User" => $this->security->getUser(),
            "FenAfter" => $fenBefore
        ]);
        foreach ($res as $rec) {
            // if this move is included
            if (!$rec->isExclude()) {
                // if this is not the root position
                if ($rec->getFenBefore() !== $rec->getFenAfter()) {
                    // check if one of the parent moves is included
                    $included = $this->isIncluded($rec->getFenBefore());
                    if ($included) {
                        break;
                    }
                } else {
                    $included = true;
                    break;
                }
            }
        }

        return count($res) == 0 ? true : $included;
    }
}
